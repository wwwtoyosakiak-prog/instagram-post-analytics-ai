export type RetryOptions = {
  attempts?: number;
  delaysMs?: number[];
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (nextAttempt: number) => void;
};

export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delays = options.delaysMs ?? [600, 1_800];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const retryable = options.shouldRetry?.(error) ?? true;
      if (!retryable || attempt === attempts) throw error;
      options.onRetry?.(attempt + 1);
      const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Retry attempts exhausted.");
}
