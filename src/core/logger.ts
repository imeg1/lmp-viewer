export const logger = {
  info(message: string): void {
    console.info('[Lampa Stream]', message);
  },
  error(message: string, error?: unknown): void {
    // Do not dump movie objects, URLs, or user/account data.
    console.error('[Lampa Stream]', message, error instanceof Error ? error.message : '');
  },
};
