import { readFile } from 'fs/promises';
import OpenAI from 'openai';

const PROMPT_VERSION = 'enrich-v1';
const promptPath = new URL(`../../prompts/${PROMPT_VERSION}.md`, import.meta.url).pathname;

let cachedSystemPrompt = null;
async function loadSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = await readFile(promptPath, 'utf-8');
  }
  return cachedSystemPrompt;
}

const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    timeout: 30000, // 30s — the SDK's own default is 10 minutes, which is not a real timeout
    maxRetries: 0, // we implement our own retry policy below instead of relying on the SDK's silent default
  });
  
  const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;
  const BASE_DELAY_MS = 1000;
  
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  function isRetryable(err) {
    if (err.status && RETRYABLE_STATUS_CODES.has(err.status)) return true;
    if (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT') return true;
    return false;
  }
  
  async function createWithRetry(params) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await client.chat.completions.create(params);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === MAX_ATTEMPTS) {
          throw err;
        }
        const retryAfterHeader = err.headers?.['retry-after'];
        const delayMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 300;
        console.log(
          JSON.stringify({
            event: 'llm_retry',
            attempt,
            status: err.status || err.code,
            delay_ms: Math.round(delayMs),
          })
        );
        await sleep(delayMs);
      }
    }
    throw lastError;
  }

/**
 * Call the model with the book record as a separate user message.
 * Returns the raw text content — parsing and validation happen elsewhere (Stage 3).
 */
export async function callModel(input, repairMessage = null) {
    if (process.env.LLM_ENABLED === 'false') {
      const err = new Error('LLM_DISABLED');
      err.isKillSwitch = true;
      throw err;
    }
  
    const startedAt = Date.now();
    const systemPrompt = await loadSystemPrompt();
  
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(input) },
    ];
  
    if (repairMessage) {
      messages.push({ role: 'user', content: repairMessage });
    }
  
    const response = await createWithRetry({
      model: process.env.LLM_MODEL,
      temperature: 0,
      messages,
    });
  
    const durationMs = Date.now() - startedAt;
  
    console.log(
      JSON.stringify({
        event: 'llm_call',
        prompt_version: PROMPT_VERSION,
        model: process.env.LLM_MODEL,
        input_tokens: response.usage?.prompt_tokens ?? null,
        output_tokens: response.usage?.completion_tokens ?? null,
        duration_ms: durationMs,
        is_repair: Boolean(repairMessage),
      })
    );
  
    return {
      text: response.choices[0].message.content,
      usage: response.usage,
    };
  }
export { PROMPT_VERSION };
