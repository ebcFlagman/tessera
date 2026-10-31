import { z } from 'zod';

export const errorCodes = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'validation_failed',
  'conflict',
  'internal',
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export const errorBodySchema = z.object({
  code: z.enum(errorCodes),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

const statusByCode: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  conflict: 409,
  internal: 500,
};

/** Domain/service error that maps 1:1 to the API error body. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return statusByCode[this.code];
  }

  toBody(): ErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
