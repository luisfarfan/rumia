/**
 * Run in an isolated child process (see extractionRouting.test.ts) with a
 * scrubbed env and a cwd containing no .env file. Merely importing
 * dispatchIngestion.js must succeed and must not exit the process: any
 * module in its import graph that has a load-time side effect (e.g. the
 * Telegram bot client calling process.exit(1) without a token) would make
 * this script exit non-zero or never reach the end.
 */
import { dispatchIngestion } from '../../src/workers/ingestion/dispatchIngestion.js';

if (typeof dispatchIngestion !== 'function') {
  console.error('dispatchIngestion did not import as a function');
  process.exit(1);
}

process.exit(0);
