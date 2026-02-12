#!/usr/bin/env node

import { program } from 'commander';

program
  .name('crawlbeacon')
  .description('SEO linter for your deployment pipeline')
  .version('0.1.0');

program
  .command('check <url>')
  .description('Run SEO checks on a URL')
  .option('-f, --format <format>', 'Output format: terminal, json, markdown', 'terminal')
  .option('--fail-on <severity>', 'Exit with error code on: error, warning, none', 'error')
  .action((url, options) => {
    console.log(`TODO: check ${url} with options`, options);
  });

program.parse();
