import 'dotenv/config';
import express from 'express';
import { InputSchema, OutputSchema } from './llm/schema.js';
import { enrichWithRepair } from './llm/repair.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// A fixed, schema-valid fake answer used when LLM_STUB=1 — no model call happens.
function stubEnrich() {
  return {
    category: 'Fiction',
    summary: 'A stubbed summary standing in for a real model response.',
    quality_flags: [],
    confidence: 0.42,
  };
}

app.post('/enrich', async (req, res) => {
  const parsedInput = InputSchema.safeParse(req.body);
  if (!parsedInput.success) {
    const firstIssue = parsedInput.error.issues[0];
    return res.status(400).json({
      error: `Invalid field "${firstIssue.path.join('.')}": ${firstIssue.message}`,
    });
  }

  if (process.env.LLM_STUB === '1') {
    const stub = stubEnrich();
    return res.status(200).json(OutputSchema.parse(stub));
  }

  const result = await enrichWithRepair(parsedInput.data);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json(result.data);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});