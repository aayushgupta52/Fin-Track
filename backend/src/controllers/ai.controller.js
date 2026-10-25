import { prisma } from '../config/prisma.js';
import { ok, asyncHandler } from '../utils/response.js';
import {
  callGroqJSON,
  streamGroq,
  isGroqConfigured,
} from '../services/groq.service.js';
import {
  getMonthlySummary,
  computeHealthMetrics,
} from '../services/analytics.service.js';
import { cacheGet, cacheSet } from '../services/redis.service.js';
import { compareRegimes, estimateTax } from '../utils/taxCalculator.js';
import {
  CATEGORIZATION_PROMPT,
  INSIGHTS_PROMPT,
  TAX_PROMPT,
  buildChatSystemPrompt,
} from '../constants/prompts.js';
import { logger } from '../utils/logger.js';

const DAY = 86400;

// POST /api/ai/categorize — classify a single raw transaction string.
export const categorize = asyncHandler(async (req, res) => {
  const result = await callGroqJSON(CATEGORIZATION_PROMPT, req.body.text);
  return ok(res, { categorization: result });
});

// GET /api/ai/insights — monthly spending insights (cached 24h per month).
export const insights = asyncHandler(async (req, res) => {
  const summary = await getMonthlySummary(req.user.id, req.query);
  const cacheKey = `insights:${req.user.id}:${summary.year}-${summary.month}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return ok(res, { insights: cached, cached: true });

  const result = await callGroqJSON(INSIGHTS_PROMPT, JSON.stringify(summary));
  await cacheSet(cacheKey, result, DAY);
  return ok(res, { insights: result, cached: false });
});

// GET /api/ai/health-score — financial health score (cached 24h).
export const healthScore = asyncHandler(async (req, res) => {
  const summary = await getMonthlySummary(req.user.id, req.query);
  const cacheKey = `health:${req.user.id}:${summary.year}-${summary.month}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return ok(res, { healthScore: cached, cached: true });

  const metrics = computeHealthMetrics(summary);
  const result = await callGroqJSON(
    'Return ONLY JSON {"score":0-100,"grade":"A|B|C|D|F","breakdown":[{"factor":string,"note":string}],"summary":string} for these Indian personal-finance metrics.',
    JSON.stringify(metrics)
  );
  await cacheSet(cacheKey, result, DAY);
  return ok(res, { healthScore: result, cached: false });
});

// GET /api/ai/tax-suggestions — regime comparison + deduction advice.
export const taxSuggestions = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { annualIncome: true, taxRegime: true },
  });

  const annualIncome = user?.annualIncome ?? 0;
  const regime = user?.taxRegime ?? 'new';

  // Ground-truth numbers computed locally, handed to the AI for explanation.
  const computed = {
    annualIncome,
    currentRegime: regime,
    estimatedTax: estimateTax({ annualIncome, regime }).tax,
    regimeComparison: compareRegimes({ annualIncome }),
  };

  const result = await callGroqJSON(
    TAX_PROMPT,
    JSON.stringify(computed)
  );
  return ok(res, { tax: result, computed });
});

// POST /api/ai/chat — multi-turn chat streamed over Server-Sent Events.
export const chat = asyncHandler(async (req, res) => {
  const { messages } = req.body;

  // Build live financial context for the system prompt.
  const [user, summary] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }),
    getMonthlySummary(req.user.id, {}),
  ]);

  const systemPrompt = buildChatSystemPrompt({
    name: user?.name,
    monthlyIncome: summary.income,
    expenseTotal: summary.expenseTotal,
    remainingBalance: summary.remainingBalance,
    savingsRate: summary.savingsRate,
    topCategories: summary.topCategories,
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const done = () => res.write('data: [DONE]\n\n');

  if (!isGroqConfigured()) {
    send({ text: 'AI chat is not configured yet. Add a GROQ_API_KEY to enable FinBot.' });
    done();
    return res.end();
  }

  try {
    const stream = await streamGroq({
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) send({ text });
    }
  } catch (err) {
    logger.error(`[ai.chat] stream error: ${err.message}`);
    send({ error: 'The AI stream failed. Please try again.' });
  } finally {
    done();
    res.end();
  }
});
