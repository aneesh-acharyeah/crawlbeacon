import type { ScanResult } from '../../core/analyzers/types.js';
import type { Reporter } from './types.js';

export const jsonReporter: Reporter = {
  format(result: ScanResult): string {
    return JSON.stringify(result, null, 2);
  },
};
