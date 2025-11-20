import { useState, useCallback } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: number;
}

export function useRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const execute = useCallback(async (): Promise<T> => {
    setIsRetrying(true);
    setAttemptCount(0);

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setAttemptCount(attempt);
        const result = await operation();
        setIsRetrying(false);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          const nextDelay = delay * Math.pow(backoff, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, nextDelay));
        }
      }
    }

    setIsRetrying(false);
    throw lastError!;
  }, [operation, maxAttempts, delay, backoff]);

  return { execute, isRetrying, attemptCount };
}