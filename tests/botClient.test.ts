import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the split between the Telegram *client* and the process that *starts*
 * polling.
 *
 * Telegram allows exactly one `getUpdates` connection per token. When the
 * ingestion worker imports a handler that transitively pulls in the module which
 * calls `bot.start()`, a second poller opens and Telegram rejects both with HTTP
 * 409 Conflict. These tests fail the moment that import path comes back.
 *
 * `grammy` is mocked so nothing here touches the network or needs a real token.
 */
// `index.ts` chains off the promise `start()` returns, so the spy must resolve.
const startSpy = vi.fn(() => Promise.resolve());

vi.mock('grammy', () => ({
  Bot: class {
    api = { getFile: vi.fn() };
    start = startSpy;
    on = vi.fn();
    command = vi.fn();
    catch = vi.fn();
  },
}));

beforeEach(() => {
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token-de-prueba');
  startSpy.mockClear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('separación entre el cliente de Telegram y el arranque del polling', () => {
  it('importar audioTranscriptionHandler no invoca bot.start()', async () => {
    await import('../src/workers/ingestion/handlers/audioTranscriptionHandler.js');

    expect(startSpy).not.toHaveBeenCalled();
  });

  it('importar el módulo del cliente tampoco invoca bot.start()', async () => {
    const { bot } = await import('../src/bot/client.js');

    expect(bot).toBeDefined();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('importar src/bot/index.ts sí invoca bot.start()', async () => {
    await import('../src/bot/index.js');

    expect(startSpy).toHaveBeenCalledTimes(1);
  });
});
