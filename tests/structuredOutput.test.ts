import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { extractJsonObject, parseStructured } from '../src/core/llm/structuredOutput.js';

/**
 * cliproxyapi accepts OpenAI's `json_schema` response format and answers in
 * Markdown regardless, so every structured call died on `JSON.parse` with
 * `Unexpected token '*', "**Category"...`. Categorization, fact-checking and
 * graph extraction all failed silently: items still ended up `extracted`, just
 * always categorized `Unknown` — which in turn meant fact-checking never ran.
 *
 * The second half of the bug was quieter: the old code did `JSON.parse(x) as T`
 * with no validation, so JSON of the wrong shape passed through as if checked.
 */

const Esquema = z.object({
  category: z.enum(['News', 'Tutorial', 'Documentation']),
  tags: z.array(z.string()).max(5),
});

describe('extractJsonObject', () => {
  it('saca el JSON de un bloque de código Markdown', () => {
    const texto = 'Claro, aquí tienes:\n```json\n{"category":"Tutorial","tags":["rag"]}\n```\n¿Algo más?';

    expect(extractJsonObject(texto)).toBe('{"category":"Tutorial","tags":["rag"]}');
  });

  it('saca el JSON incrustado en prosa, sin bloque de código', () => {
    const texto = 'El resultado es {"category":"News","tags":[]} según el análisis.';

    expect(extractJsonObject(texto)).toBe('{"category":"News","tags":[]}');
  });

  it('no se corta con llaves dentro de un string', () => {
    const texto = '{"category":"News","tags":["usa {llaves} aquí"]}';

    expect(extractJsonObject(texto)).toBe(texto);
    expect(JSON.parse(extractJsonObject(texto)!).tags[0]).toBe('usa {llaves} aquí');
  });

  it('respeta las comillas escapadas', () => {
    const texto = '{"category":"News","tags":["dijo \\"hola\\""]}';

    expect(JSON.parse(extractJsonObject(texto)!).tags[0]).toBe('dijo "hola"');
  });

  it('devuelve null cuando no hay ningún objeto', () => {
    expect(extractJsonObject('**Category**: Tutorial\n**Tags**: rag, llm')).toBeNull();
  });
});

describe('parseStructured', () => {
  it('valida contra el esquema y devuelve los datos', () => {
    const resultado = parseStructured<z.infer<typeof Esquema>>(
      '```json\n{"category":"Documentation","tags":["rag","llm"]}\n```',
      Esquema
    );

    expect(resultado).toEqual({ category: 'Documentation', tags: ['rag', 'llm'] });
  });

  it('rechaza un JSON válido cuya forma no cumple el esquema', () => {
    // Este es el caso que el viejo `JSON.parse(x) as T` dejaba pasar entero.
    expect(() => parseStructured('{"category":"Inventada","tags":[]}', Esquema)).toThrow(
      /does not match the schema/
    );
  });

  it('falla con la respuesta en Markdown que provocó el bug', () => {
    expect(() => parseStructured('**Category**: Tutorial\n**Tags**: rag', Esquema)).toThrow(
      /No JSON object found/
    );
  });
});

/** Fake OpenAI client so the repair turn can be observed without a network call. */
const create = vi.fn();
vi.mock('openai', () => ({
  OpenAI: class {
    chat = { completions: { create } };
    embeddings = { create: vi.fn() };
  },
}));

beforeEach(() => {
  create.mockReset();
  vi.stubEnv('CLIPROXY_FLASH_MODEL', 'gemini-3-flash');
  vi.stubEnv('CLIPROXY_PRO_MODEL', 'gemini-pro-agent');
});

function respuesta(content: string) {
  return { model: 'gemini-3-flash', usage: undefined, choices: [{ message: { content } }] };
}

describe('CLIProxyProvider.generateStructured', () => {
  it('reintenta una vez cuando el modelo responde en Markdown, y devuelve el dato validado', async () => {
    create
      .mockResolvedValueOnce(respuesta('**Category**: Tutorial\n**Tags**: rag'))
      .mockResolvedValueOnce(respuesta('{"category":"Tutorial","tags":["rag"]}'));
    const { CLIProxyProvider } = await import('../src/core/llm/providers/CLIProxyProvider.js');

    const resultado = await new CLIProxyProvider().generateStructured('clasifica esto', Esquema, {
      schemaName: 'test',
    });

    expect(resultado).toEqual({ category: 'Tutorial', tags: ['rag'] });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('lanza si el reintento tampoco sirve, en vez de devolver algo sin validar', async () => {
    create.mockResolvedValue(respuesta('sigo respondiendo en prosa'));
    const { CLIProxyProvider } = await import('../src/core/llm/providers/CLIProxyProvider.js');

    await expect(
      new CLIProxyProvider().generateStructured('clasifica esto', Esquema, { schemaName: 'test' })
    ).rejects.toThrow(/No JSON object found/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('pide el JSON también en el prompt, no solo en response_format', async () => {
    create.mockResolvedValue(respuesta('{"category":"News","tags":[]}'));
    const { CLIProxyProvider } = await import('../src/core/llm/providers/CLIProxyProvider.js');

    await new CLIProxyProvider().generateStructured('clasifica esto', Esquema, { schemaName: 'test' });

    const enviado = create.mock.calls[0]![0];
    const userTurn = enviado.messages.find((m: { role: string }) => m.role === 'user');
    expect(userTurn.content).toMatch(/ÚNICAMENTE con un objeto JSON/);
    expect(userTurn.content).toContain('"category"');
    expect(enviado.response_format.type).toBe('json_schema');
  });
});
