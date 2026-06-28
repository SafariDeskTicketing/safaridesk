type ApiErrorPayload = {
  message?: string;
  detail?: string;
  details?: string;
  error?: string;
  errors?: Record<string, unknown>;
  [key: string]: unknown;
};

const stringifyValidationValue = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const messages = value
      .map((item) => stringifyValidationValue(item))
      .filter((item): item is string => Boolean(item));
    return messages.length ? messages.join(', ') : null;
  }
  if (value && typeof value === 'object') {
    const messages = Object.values(value)
      .map((item) => stringifyValidationValue(item))
      .filter((item): item is string => Boolean(item));
    return messages.length ? messages.join(', ') : null;
  }
  return null;
};

export const getApiErrorMessage = (error: unknown, fallback = 'An error occurred'): string => {
  const payload = (error as { response?: { data?: ApiErrorPayload } })?.response?.data;

  if (payload) {
    const directMessage = payload.message || payload.detail || payload.details || payload.error;
    if (typeof directMessage === 'string' && directMessage.trim()) {
      return directMessage;
    }

    const nestedErrors = stringifyValidationValue(payload.errors);
    if (nestedErrors) return nestedErrors;

    const fieldErrors = stringifyValidationValue(payload);
    if (fieldErrors) return fieldErrors;
  }

  return error instanceof Error && error.message ? error.message : fallback;
};
