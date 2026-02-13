import type { ScanResult } from '../../core/analyzers/types.js';

export interface Reporter {
  /** Format a scan result into a string for output */
  format(result: ScanResult): string;
}
