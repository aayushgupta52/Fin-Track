import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/response.js';

// Instantiate only when a key is present so the app runs fine without AI in dev.
const client = env.groq.apiKey ? new Groq({ apiKey: env.groq.apiKey }) : null;

if (!client) {
  logger.warn('[groq] disabled (missing GROQ_API_KEY) — AI endpoints will return 503');
}

export const isGroqConfigured = () => Boolean(client);

const ensureClient = () => {
  if (!client) throw new ApiError(503, 'AI service is not configured (missing GROQ_API_KEY)');
  return client;
};

const FALLBACK_MODEL = 'openai/gpt-oss-120b';
const isUnavailableModelError = (err) => {
  const text = `${err?.message || ''} ${err?.error?.code || ''} ${err?.code || ''}`;
  return err?.status === 404 || /model[_ -]not[_ -]found|model.{0,50}(retired|decommissioned|not found|does not exist|not available)/i.test(text);
};

const createCompletionWithModelFallback = async (options) => {
  const api = ensureClient();
  try {
    return await api.chat.completions.create({ ...options, model: env.groq.model });
  } catch (err) {
    if (env.groq.model === FALLBACK_MODEL || !isUnavailableModelError(err)) throw err;
    logger.warn(`[groq] configured model '${env.groq.model}' is unavailable; retrying with '${FALLBACK_MODEL}'`);
    return api.chat.completions.create({ ...options, model: FALLBACK_MODEL });
  }
};

// Single-shot completion. Returns the raw assistant message string.
export const callGroq = async (
  systemPrompt,
  userMessage,
  { json = false, temperature = 0.3, maxTokens = 2048 } = {}
) => {
  const res = await createCompletionWithModelFallback({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: json ? { type: 'json_object' } : undefined,
  });
  return res.choices[0]?.message?.content ?? '';
};

// Extracts a JSON object/array from a model response, tolerating stray prose
// or code fences that occasionally slip past json mode.
const parseJsonLoose = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new ApiError(502, 'AI returned malformed JSON');
  }
};

export const callGroqJSON = async (systemPrompt, userMessage, opts = {}) => {
  const raw = await callGroq(systemPrompt, userMessage, { ...opts, json: true });
  return parseJsonLoose(raw);
};

// Returns an async-iterable streaming completion, or null if AI is disabled
// (callers handle the null case so they can still send an SSE fallback).
export const streamGroq = async ({ messages, temperature = 0.5, maxTokens = 1024 }) => {
  if (!client) return null;
  return createCompletionWithModelFallback({
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  });
};
