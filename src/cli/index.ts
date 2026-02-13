import { program } from 'commander';
import { runCheck } from './commands/check.js';
import type { CheckOptions } from './commands/check.js';

program
  .name('crawlbeacon')
  .description('SEO linter for your deployment pipeline')
  .version('0.1.0');

program
  .command('check <url>')
  .description('Run SEO checks on a URL')
  .option('-f, --format <format>', 'Output format: terminal, json', 'terminal')
  .option('--fail-on <severity>', 'Exit with error code on: error, warning, none', 'error')
  .action(async (url: string, options: CheckOptions) => {
    await runCheck(url, options);
  });

program.parse();
