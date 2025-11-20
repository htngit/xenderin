export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

export function handleServiceError(error: unknown, context: string): AppError {
  console.error(`Service error in ${context}:`, error);

  // Handle different types of errors
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
      code: error.name,
      details: error
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR'
    };
  }

  // Handle network errors
  if (error && typeof error === 'object' && 'status' in error) {
    const statusCode = (error as any).status;
    switch (statusCode) {
      case 401:
        return {
          message: 'Authentication failed. Please log in again.',
          code: 'UNAUTHORIZED'
        };
      case 403:
        return {
          message: 'You do not have permission to perform this action.',
          code: 'FORBIDDEN'
        };
      case 404:
        return {
          message: 'The requested resource was not found.',
          code: 'NOT_FOUND'
        };
      case 500:
        return {
          message: 'A server error occurred. Please try again later.',
          code: 'SERVER_ERROR'
        };
      default:
        return {
          message: `Network error: ${statusCode}`,
          code: 'NETWORK_ERROR'
        };
    }
  }

  // Fallback for unknown error types
  return {
    message: 'An unexpected error occurred while processing your request.',
    code: 'UNKNOWN_ERROR',
    details: error
  };
}