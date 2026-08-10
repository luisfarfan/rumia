import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A failing vision tier must not be able to masquerade as content.
 *
 * The agent used to catch the vision error and return the message itself as the
 * visual analysis. That string was then fed to the synthesis prompt, written into
 * the wiki entry, categorized, embedded and pushed into the graph — so a broken
 * vision model produced items that looked perfectly ingested. These tests pin the
 * three guarantees: the error text never reaches the content, the failure is
 * reported to the caller, and whatever transcript we do have is still kept.
 */

const VISION_ERROR = 'unknown provider for model gpt-4o';
const TRANSCRIPT = 'Los workers de BullMQ procesan la cola de ingesta.';

const generateCompletion = vi.fn(
  async (prompt: string, options?: { modelTier?: string }) => {
    if (options?.modelTier === 'vision') throw new Error(VISION_ERROR);
    // The synthesis tier echoes its prompt so the test can assert on exactly what
    // the model was given, not on a canned reply.
    return `# Entrada sintetizada\n\n${prompt}`;
  }
);

vi.mock('../src/core/llm/LLMFactory.js', () => ({
  LLMFactory: { getChatProvider: () => ({ generateCompletion }) },
}));

beforeEach(() => {
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token-de-prueba');
  generateCompletion.mockClear();
});

async function runConVisionRota() {
  const { runIngestionAgent } = await import('../src/agents/ingestionAgent.js');
  return runIngestionAgent({
    url: 'https://www.tiktok.com/@x/video/123',
    itemId: 'item-1',
    title: 'Video de prueba',
    duration: 30,
    subtitlesText: TRANSCRIPT,
    audioPath: null,
    framePaths: ['/tmp/frame-001.jpg', '/tmp/frame-002.jpg'],
  });
}

describe('fallo de visión durante la ingesta', () => {
  it('el texto del error no aparece en el contenido sintetizado', async () => {
    const result = await runConVisionRota();

    expect(result.content).not.toContain(VISION_ERROR);
    expect(result.content).not.toMatch(/Error analizando/i);
  });

  it('el resultado marca el ítem como degradado', async () => {
    const result = await runConVisionRota();

    expect(result.visualAnalysisFailed).toBe(true);
  });

  it('la transcripción disponible se conserva pese al fallo', async () => {
    const result = await runConVisionRota();

    expect(result.content).toContain(TRANSCRIPT);
  });

  it('la sección visual se omite del prompt en vez de llevar un marcador', async () => {
    await runConVisionRota();

    const promptDeSintesis = generateCompletion.mock.calls.find(
      ([, options]) => options?.modelTier === 'pro'
    )?.[0];

    expect(promptDeSintesis).toBeDefined();
    expect(promptDeSintesis).not.toContain('VISUAL TIMELINE ANALYSIS');
    expect(promptDeSintesis).toContain(TRANSCRIPT);
  });

  it('con visión sana, el análisis visual sí llega al prompt', async () => {
    generateCompletion.mockImplementationOnce(async () => 'timeline visual real');
    const { runIngestionAgent } = await import('../src/agents/ingestionAgent.js');

    const result = await runIngestionAgent({
      url: 'https://www.tiktok.com/@x/video/123',
      itemId: 'item-2',
      title: 'Video de prueba',
      duration: 30,
      subtitlesText: TRANSCRIPT,
      audioPath: null,
      framePaths: ['/tmp/frame-001.jpg'],
    });

    expect(result.visualAnalysisFailed).toBe(false);
    expect(result.content).toContain('VISUAL TIMELINE ANALYSIS');
  });
});
