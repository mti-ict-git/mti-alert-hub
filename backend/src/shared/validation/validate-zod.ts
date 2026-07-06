import { ZodError, type ZodType } from "zod";

import { AppError } from "../errors/app-error.js";

export function validateWithSchema<T>(
  schema: ZodType<T, any, unknown>,
  payload: unknown,
): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "The request payload failed validation.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    throw error;
  }
}
