import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * The default 5s is too tight here, and not because any test is slow.
     *
     * These suites do dynamic imports under `vi.resetModules()`, and the dev
     * machine normally runs the bot, three workers and the dashboard at the same
     * time. Under that load, module resolution alone can exceed 5s and three
     * unrelated files fail together — the suite passes with
     * `--no-file-parallelism`, which is the tell that it is contention rather
     * than a defect. None of these tests measure latency, so the timeout is
     * raised instead of the parallelism removed.
     */
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
