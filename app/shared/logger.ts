export const Logger = {
  debug(...args: unknown[]): void {
    console.debug('[SesWi]', ...args);
  },
  info(...args: unknown[]): void {
    console.info('[SesWi]', ...args);
  },
  warn(...args: unknown[]): void {
    console.warn('[SesWi]', ...args);
  },
  error(...args: unknown[]): void {
    console.error('[SesWi]', ...args);
  },
} as const;
