/**
 * Internal debug logger. Only outputs when CRAWLBEACON_DEBUG=1.
 */

const DEBUG = process.env.CRAWLBEACON_DEBUG === '1';

export function debug(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.error(`[crawlbeacon] ${message}`, ...args);
  }
}
