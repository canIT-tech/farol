const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// Status que valem uma nova tentativa: rate limit e falha transitória do provider.
// 4xx que não é 429 é erro nosso — não retenta.
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}
