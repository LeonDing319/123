export const errorStatus = {
  invalid_request: 400, unknown_model: 400, unsupported_capability: 422,
  missing_key: 503, authentication: 502, insufficient_balance: 503,
  rate_limited: 429, timeout: 504, network: 502, upstream: 502,
  invalid_response: 502, too_large: 413, forbidden: 403, configuration: 500,
} as const;

export class ProviderError extends Error {
  readonly code: keyof typeof errorStatus;
  constructor(code: keyof typeof errorStatus) {
    super(code);
    this.code = code;
  }
}
