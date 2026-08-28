import { appendFile, mkdir } from 'fs/promises';
import { OutputSchema } from './schema.js';
import { callModel, PROMPT_VERSION } from './client.js';

const QUARANTINE_PATH = new URL('../../logs/quarantine.jsonl', import.meta.url).pathname;
const LOGS_DIR = new URL('../../logs/', import.meta.url).pathname;

/**
 * Strip a markdown code fence if the model wrapped its JSON in one,
 * and find the first { ... } object in the text if there's stray text around it.
 */
function extractJson(text) {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    return cleaned;
  }
  return cleaned.slice(firstBrace, lastBrace + 1);
}

function tryParse(text) {
  try {
    return { ok: true, value: JSON.parse(extractJson(text)) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function logQuarantine(entry) {
  await mkdir(LOGS_DIR, { recursive: true });
  await appendFile(QUARANTINE_PATH, JSON.stringify(entry) + '\n');
}

/**
 * The full parse -> validate -> repair-once -> quarantine pipeline.
 * Returns { ok: true, data, usage } on success, or { ok: false, status, error } on failure.
 * Never throws, never returns raw model text.
 */
export async function enrichWithRepair(input) {
    let first;
    try {
      first = await callModel(input);
    } catch (err) {
      if (err.isKillSwitch) throw err; // let index.js handle this separately
      return {
        ok: false,
        status: err.status === 408 || err.code === 'ETIMEDOUT' ? 504 : 502,
        error: `Model call failed: ${err.message}`,
      };
    }

  const firstParse = tryParse(first.text);
  if (firstParse.ok) {
    const validated = OutputSchema.safeParse(firstParse.value);
    if (validated.success) {
      return { ok: true, data: validated.data, usage: first.usage, repaired: false };
    }
  }

  const errorMessage = firstParse.ok
    ? `Validation failed: ${JSON.stringify(OutputSchema.safeParse(firstParse.value).error.issues)}`
    : `JSON parsing failed: ${firstParse.error}`;

  const repairPrompt = `Your previous answer was rejected for this reason: ${errorMessage}\n\nYour previous answer was:\n${first.text}\n\nReturn only corrected JSON matching the schema.`;
  let second;
  try {
    second = await callModel(input, repairPrompt);
  } catch (err) {
    return {
      ok: false,
      status: err.status === 408 || err.code === 'ETIMEDOUT' ? 504 : 502,
      error: `Repair attempt failed: ${err.message}`,
    };
  }

  const secondParse = tryParse(second.text);
  if (secondParse.ok) {
    const validated = OutputSchema.safeParse(secondParse.value);
    if (validated.success) {
      return { ok: true, data: validated.data, usage: second.usage, repaired: true };
    }
  }

  await logQuarantine({
    timestamp: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    input,
    first_attempt: first.text,
    second_attempt: second.text,
    error: secondParse.ok
      ? OutputSchema.safeParse(secondParse.value).error?.issues
      : secondParse.error,
  });

  return {
    ok: false,
    status: 422,
    error: 'Model output could not be validated after one repair attempt',
  };
}