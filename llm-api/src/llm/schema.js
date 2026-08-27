import { z } from 'zod';

export const CATEGORIES = [
  'Fiction',
  'Nonfiction',
  'Poetry',
  "Children's",
  'Business & Self-Help',
  'Other',
];

export const QUALITY_FLAGS = [
  'missing_description',
  'price_suspicious',
  'title_truncated',
  'duplicate_description',
];

export const InputSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(3000).nullable(),
  price_gbp: z.number(),
  availability_text: z.string(),
});

export const OutputSchema = z.object({
  category: z.enum(CATEGORIES),
  summary: z.string().min(1),
  quality_flags: z.array(z.enum(QUALITY_FLAGS)),
  confidence: z.number().min(0).max(1),
});