import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { downloadFile } from './cloudinary.service.js';
import { extractText } from './ocr.service.js';
import { callGroqJSON, isGroqConfigured } from './groq.service.js';
import { EXTRACTION_PROMPT } from '../constants/prompts.js';
import { CATEGORY_NAMES } from '../constants/categories.js';

const MAX_TEXT_FOR_AI = 6000;
const VALID_CATEGORIES = new Set(CATEGORY_NAMES);
const MAX_TRANSACTION_AMOUNT = 1_000_000_000;

const safeDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const friendlyProcessingError = (err) => {
  const msg = String(err?.message || 'Unknown processing error');
  if (/model.*(not found|does not exist|decommission|not available)/i.test(msg)) {
    return 'The configured AI model is unavailable. Update GROQ_MODEL to openai/gpt-oss-120b and try again.';
  }
  if (/invalid.*api.?key|unauthorized|authentication/i.test(msg)) {
    return 'The AI provider rejected its API key. Update GROQ_API_KEY in backend/.env, restart the backend, then retry.';
  }
  if (/rate.?limit|quota|too many requests/i.test(msg)) {
    return 'The AI provider rate limit or quota was reached. Try again later.';
  }
  if (/timeout|timed out|fetch failed|network/i.test(msg)) {
    return 'The document was uploaded, but the OCR/AI service could not be reached. Check network connectivity and retry.';
  }
  return 'The document was uploaded and text was extracted, but automatic transaction parsing did not finish. Check the AI configuration and retry.';
};

// Validate AI output before creating financial records. Only explicit debit or
// credit transactions are accepted; unknown types are never silently treated as debit.
const persistTransactions = async (userId, transactions, source) => {
  const expenses = [];
  const incomes = [];

  for (const t of transactions) {
    const amount = Math.abs(Number(t?.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) continue;
    if (t.type !== 'debit' && t.type !== 'credit') continue;

    const date = safeDate(t.date);
    const description = typeof t.description === 'string' ? t.description.slice(0, 280) : null;

    if (t.type === 'credit') {
      incomes.push({ userId, amount, source: 'Other', description, date });
    } else {
      expenses.push({
        userId,
        amount,
        category: VALID_CATEGORIES.has(t.category) ? t.category : 'Other',
        description,
        merchant: typeof t.merchant === 'string' ? t.merchant.slice(0, 120) : null,
        date,
        source,
      });
    }
  }

  const operations = [];
  if (expenses.length) operations.push(prisma.expense.createMany({ data: expenses }));
  if (incomes.length) operations.push(prisma.income.createMany({ data: incomes }));
  if (!operations.length) return 0;

  // Keep debit and credit imports atomic: a failed second batch must not leave
  // half of a statement imported before a retry.
  const results = await prisma.$transaction(operations);
  return results.reduce((total, result) => total + result.count, 0);
};

export const processDocument = async (documentId) => {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    logger.warn(`[doc] ${documentId} not found`);
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'processing', processingError: null },
  });

  let text = '';
  try {
    const buffer = await downloadFile(doc.fileUrl);
    text = await extractText(buffer, doc.fileType);
    if (!text || text.trim().length < 4) {
      throw new Error('No readable text found in this file. Use a clearer image or a PDF with selectable text.');
    }
  } catch (err) {
    const message = String(err?.message || 'OCR failed').slice(0, 500);
    logger.error(`[doc] ${documentId} OCR failed: ${message}`);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed', processingError: message, processedAt: new Date() },
    });
    return;
  }

  // OCR succeeded. AI parsing is a separate stage: an unavailable key/model/quota
  // should not erase the upload or the extracted text. Store it for retry/review.
  let transactionsFound = 0;
  let processingError = null;
  if (!isGroqConfigured()) {
    processingError = 'OCR completed, but AI parsing is disabled. Configure GROQ_API_KEY to extract transactions.';
  } else {
    try {
      const parsed = await callGroqJSON(EXTRACTION_PROMPT, text.slice(0, MAX_TEXT_FOR_AI));
      const transactions = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
      transactionsFound = await persistTransactions(doc.userId, transactions, doc.fileType === 'pdf' ? 'pdf' : 'ocr');
      if (transactionsFound === 0) {
        processingError = 'Text was extracted, but no transactions were confidently recognized. Check the statement or retry.';
      }
    } catch (err) {
      processingError = friendlyProcessingError(err);
      logger.error(`[doc] ${documentId} AI parsing issue: ${err.message}`);
    }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: processingError ? 'needs_review' : 'done',
      processingError,
      extractedText: text.slice(0, 10000),
      transactionsFound,
      processedAt: new Date(),
    },
  });

  if (processingError) {
    logger.warn(`[doc] ${documentId} needs review: ${processingError}`);
  } else {
    logger.info(`[doc] ${documentId} done — ${transactionsFound} transactions`);
  }
};
