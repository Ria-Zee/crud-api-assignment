# Job card

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