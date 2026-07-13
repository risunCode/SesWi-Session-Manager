/**
 * Response utility helpers
 */

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  context?: string;
}

export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

export const Response = {
  success<T>(data: T, message?: string): SuccessResponse<T> {
    return { success: true, data, ...(message && { message }) };
  },

  error(error: Error | string, context?: string): ErrorResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      ...(context && { context })
    };
  }
};
