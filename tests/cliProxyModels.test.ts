import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLIProxyProvider } from '../src/core/llm/providers/CLIProxyProvider.js';
import { OpenRouterProvider } from '../src/core/llm/providers/OpenRouterProvider.js';

/**
 * Every model identifier must come from configuration.
 *
 * The vision tier used to return a hard-coded `gpt-4o`, which the configured proxy
 * does not serve — every visual analysis failed with
 * `502 unknown provider for model gpt-4o`. A literal pinned in code cannot be
 * corrected by config, so these tests assert the tiers resolve from the
 * environment and that no tier can return a name nobody configured.
 */

// `getModel` is private; the tier resolution is what is under test, so reach it
// through the instance rather than duplicating the mapping in the test.
function modelFor(provider: object, tier: string): string {
  return (provider as { getModel: (t: string) => string })['getModel'](tier);
}

const CLIPROXY_VARS = [
  'CLIPROXY_FLASH_MODEL',
  'CLIPROXY_PRO_MODEL',
  'CLIPROXY_VISION_MODEL',
  'CLIPROXY_THINKING_MODEL',
] as const;

beforeEach(() => {
  for (const key of CLIPROXY_VARS) vi.stubEnv(key, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('CLIProxyProvider: resolución de tiers', () => {
  it('vision y thinking usan sus variables cuando están definidas', () => {
    vi.stubEnv('CLIPROXY_FLASH_MODEL', 'flash-configurado');
    vi.stubEnv('CLIPROXY_PRO_MODEL', 'pro-configurado');
    vi.stubEnv('CLIPROXY_VISION_MODEL', 'vision-configurado');
    vi.stubEnv('CLIPROXY_THINKING_MODEL', 'thinking-configurado');

    const provider = new CLIProxyProvider();

    expect(modelFor(provider, 'vision')).toBe('vision-configurado');
    expect(modelFor(provider, 'thinking')).toBe('thinking-configurado');
  });

  it('sin esas variables, vision cae a FLASH y thinking cae a PRO', () => {
    vi.stubEnv('CLIPROXY_FLASH_MODEL', 'flash-configurado');
    vi.stubEnv('CLIPROXY_PRO_MODEL', 'pro-configurado');

    const provider = new CLIProxyProvider();

    expect(modelFor(provider, 'vision')).toBe('flash-configurado');
    expect(modelFor(provider, 'thinking')).toBe('pro-configurado');
  });

  it('ningún tier devuelve un modelo que no esté configurado', () => {
    vi.stubEnv('CLIPROXY_FLASH_MODEL', 'flash-configurado');
    vi.stubEnv('CLIPROXY_PRO_MODEL', 'pro-configurado');

    const provider = new CLIProxyProvider();
    const configurados = ['flash-configurado', 'pro-configurado'];

    for (const tier of ['flash', 'pro', 'vision', 'thinking', undefined]) {
      expect(configurados).toContain(modelFor(provider, tier as string));
    }
  });

  it('falla al construirse si falta la configuración de modelos', () => {
    expect(() => new CLIProxyProvider()).toThrowError(/CLIPROXY_FLASH_MODEL/);
  });
});

describe('OpenRouterProvider: resolución de tiers', () => {
  it('vision y thinking usan sus variables, y si no caen a flash y pro', () => {
    vi.stubEnv('OPENROUTER_FLASH_MODEL', 'or-flash');
    vi.stubEnv('OPENROUTER_PRO_MODEL', 'or-pro');
    vi.stubEnv('OPENROUTER_VISION_MODEL', '');
    vi.stubEnv('OPENROUTER_THINKING_MODEL', '');

    const porDefecto = new OpenRouterProvider();
    expect(modelFor(porDefecto, 'vision')).toBe('or-flash');
    expect(modelFor(porDefecto, 'thinking')).toBe('or-pro');

    vi.stubEnv('OPENROUTER_VISION_MODEL', 'or-vision');
    const configurado = new OpenRouterProvider();
    expect(modelFor(configurado, 'vision')).toBe('or-vision');
  });
});
