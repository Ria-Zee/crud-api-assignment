import { z } from 'zod';

/**
 * The shape of a finished, validated book record.
 * price_text/raw fields are kept alongside their clean counterparts.
 */
export const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string(),
  price_gbp: z.number().nonnegative(),
  availability_text: z.string(),
  rating_text: z.string().nullable(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string(),
});

/**
 * Turn one raw extracted record into a normalized record, ready for validation.
 * Never throws — bad price text just produces NaN, which the schema will reject.
 */
export function normalizeRecord(raw) {
  const priceGbp = Number.parseFloat(raw.price_text.replace(/[^\d.]/g, ''));

  return {
    ...raw,
    price_gbp: priceGbp,
  };
}