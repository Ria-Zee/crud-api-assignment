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
});

/**
 * Call the model with the book record as a separate user message.
 * Returns the raw text content — parsing and validation happen elsewhere (Stage 3).
 */
export async function callModel(input, repairMessage = null) {
    const systemPrompt = await loadSystemPrompt();
  
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(input) },
    ];
  
    if (repairMessage) {
      messages.push({ role: 'user', content: repairMessage });
    }
  
    const response = await client.chat.completions.create({
      model: process.env.LLM_MODEL,
      temperature: 0,
      messages,
    });
  
    return {
      text: response.choices[0].message.content,
      usage: response.usage,
    };
  }
export { PROMPT_VERSION };
