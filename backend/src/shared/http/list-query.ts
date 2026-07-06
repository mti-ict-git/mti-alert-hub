import { z } from "zod";

import { validateWithSchema } from "../validation/validate-zod.js";

export const baseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().optional(),
});

export type ListQuery = z.infer<typeof baseListQuerySchema>;

export function parseListQuery<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  url: URL,
): z.output<TSchema> {
  return validateWithSchema(schema, Object.fromEntries(url.searchParams.entries()));
}

export function createPageMeta(options: {
  page: number;
  pageSize: number;
  totalItems: number;
}) {
  return {
    page: options.page,
    pageSize: options.pageSize,
    totalItems: options.totalItems,
    totalPages: options.totalItems === 0 ? 0 : Math.ceil(options.totalItems / options.pageSize),
  };
}
