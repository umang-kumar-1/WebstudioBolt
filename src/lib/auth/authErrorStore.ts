type AuthErrorListener = (message: string | null) => void;

let lastError: string | null = null;
const listeners = new Set<AuthErrorListener>();

export const setAuthError = (message: string | null): void => {
  lastError = message;
  listeners.forEach((listener) => listener(message));
};

export const subscribeAuthError = (listener: AuthErrorListener): (() => void) => {
  listeners.add(listener);
  listener(lastError);
  return () => listeners.delete(listener);
};
