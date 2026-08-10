import { describe, expect, it } from 'vitest';

import { LLMFactory } from '../src/core/llm/LLMFactory.js';

/**
 * Proves the test runner can execute TypeScript ESM against this project's own
 * source without a build step — importing a real module, not just asserting on
 * literals. If module resolution or the ESM/TS pipeline breaks, this fails.
 */
describe('smoke', () => {
  it('ejecuta TypeScript ESM', () => {
    const answer: number = 21 * 2;
    expect(answer).toBe(42);
  });

  it('resuelve imports del propio src/ sin paso de build', () => {
    expect(typeof LLMFactory.getChatProvider).toBe('function');
  });
});
