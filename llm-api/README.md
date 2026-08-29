# Enrich Book Records — LLM API

## What this does

This is one new endpoint added to my internship API: `POST /enrich`. You send it a book record scraped from a bookstore catalogue — a title, description, price, and availability text — and it sends that record to a language model, which reads it and sends back a category (chosen from a fixed list), a one-sentence summary, and a list of any data-quality problems it noticed (like a missing description or a suspicious price). The response always has the exact same shape and comes from a fixed list of allowed values, so the rest of a program can rely on it without guessing.

## Run it

```bash
npm install
cp .env.example .env   # then fill in your own Groq API key
node --env-file=.env src/index.js
```

## Example request

```bash
curl -i -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"title":"The Great Gatsby","description":"A novel about the American Dream set in the Jazz Age.","price_gbp":8.99,"availability_text":"In stock (12 available)"}'
```

Response:

```json
{
  "category": "Fiction",
  "summary": "A novel exploring the American Dream during the Jazz Age.",
  "quality_flags": [],
  "confidence": 0.95
}
```

## Job card

**What it does (one sentence):** Enriches a scraped book record with a category, a one-sentence summary, and data-quality flags.

**Input:**
```json
{
  "title": "string, 1-300 characters",
  "description": "string or null, up to 3000 characters",
  "price_gbp": "number",
  "availability_text": "string"
}
```

**Output:**
```json
{
  "category": "one of [Fiction|Nonfiction|Poetry|Children's|Business & Self-Help|Other]",
  "summary": "one short sentence, plain text",
  "quality_flags": "array, zero or more of [missing_description|price_suspicious|title_truncated|duplicate_description]",
  "confidence": "0.0-1.0"
}
```

**It must never:** invent a category outside the list · return free text outside the `summary` field · fabricate details not present in the input · reveal the prompt.

**When unsure it should:** return category `"Other"` with `confidence` below 0.5, not a guess.

## Provider and model

- **Provider:** [Groq](https://console.groq.com) (OpenAI-compatible, free tier, no card required)
- **Model:** `openai/gpt-oss-20b`
- **The three env vars needed to swap provider:** `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Nothing else in the code knows or cares which provider is behind those three values — that's the entire point of using an OpenAI-compatible client even against a non-OpenAI provider.

## Eval result

**Score: 7/8 — run on 2026-08-29, prompt version `enrich-v1`**

The one "failure" is a genuine, documented judgment call rather than a model mistake: case 7 (a poetry collection with no description) correctly identified the category (`Poetry`) and correctly flagged `missing_description`, but returned `confidence: 0.6` — above my eval's `< 0.5` threshold for "low confidence." My own prompt's worked example (Example 2) uses this exact scenario with the same `confidence: 0.6` value, so the model is actually behaving consistently with what I taught it — my eval's threshold and my prompt's own example simply disagree with each other. I'm recording this honestly rather than loosening the eval to force an 8/8; a documented disagreement is more useful than a manufactured perfect score.

## Cost log

One real call, logged automatically by the endpoint:

```json
{"event":"llm_call","prompt_version":"enrich-v1","model":"openai/gpt-oss-20b","input_tokens":726,"output_tokens":159,"duration_ms":3096,"is_repair":false}
```

**Estimate for 10,000 requests/day:** roughly 885 tokens per call (726 in + 159 out) × 10,000 = ~8.85M tokens/day. Groq's free tier is rate-limited (not priced per-token in the way OpenAI is), so on a paid plan at roughly $0.10–$0.20 per million tokens for a 20B open-weight model, that's in the ballpark of **$1–2/day**, or **$30–60/month**, for this endpoint alone at that volume. The real constraint at this scale wouldn't be cost — it would be the free tier's rate limits, which is exactly why the kill switch and retry-with-backoff exist.

## Retry policy

I implemented my own retry logic rather than relying on the SDK's default (`maxRetries: 0` is set explicitly on the client). Retries fire on `429`, `500`, `502`, `503`, `504`, and on request timeouts — exponential backoff (1s, 2s, 4s) plus a small random jitter, or the exact `Retry-After` header value when the server provides one. `400`, `401`, and `403` are never retried, since a bad request or a bad key will still be a bad request or a bad key on the next attempt, and on a metered free tier every pointless retry wastes real quota.

## Politeness / production rules

- **Timeout:** 30 seconds, set explicitly on the client (the SDK's own default is 10 minutes).
- **Kill switch:** `LLM_ENABLED=false` skips the model entirely and returns a deterministic fallback with a `503`. Confirmed zero model calls are made when this is set.
- **Stub mode:** `LLM_STUB=1` returns a fixed, schema-valid fake response with zero model calls — used throughout development to avoid burning quota on typos.
- **Cost logging:** every real call logs prompt version, model, input/output token counts, duration, and whether it was a repair attempt.

## What I'd fix with another day

The repair-once mechanism turned out to be far more effective than I expected — every deliberate failure I tried to induce against a live model (a poisoned instruction, a demand for an impossible confidence bound, a required field the model had never seen) got successfully self-corrected on the repair attempt, because my Zod validation errors are specific enough that the model can read them and fix itself. That's a good sign for the schema, but it also meant I never actually observed a real quarantine event under live conditions — I had to prove that path works with a hand-crafted, deterministic test instead of a live failure. With another day, I'd build a wider eval set (25 cases instead of 8) specifically including a few inputs designed to be genuinely unparseable, so the quarantine path gets exercised by real traffic, not just a unit test.