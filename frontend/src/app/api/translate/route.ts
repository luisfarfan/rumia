import { NextResponse } from 'next/server';

export const maxDuration = 120;

/**
 * Translates a passage on demand.
 *
 * Ingestion deliberately preserves the source language — a Spanish video stays a
 * Spanish entry — so translation is an explicit action the reader takes, not
 * something that silently happens to their knowledge base.
 */
export async function POST(request: Request) {
  try {
    const { text, target } = (await request.json()) as { text?: string; target?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
    }

    const baseUrl = process.env.CLIPROXY_BASE_URL;
    const model = process.env.CLIPROXY_FLASH_MODEL;
    if (!baseUrl || !model) {
      throw new Error('CLIPROXY_BASE_URL and CLIPROXY_FLASH_MODEL must be configured to translate.');
    }

    const language = target?.trim() || 'español';

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CLIPROXY_API_KEY
          ? { Authorization: `Bearer ${process.env.CLIPROXY_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              `Traduce el texto a ${language}. Conserva el formato Markdown, los nombres propios, ` +
              'los términos técnicos y las cifras. No resumas, no añadas nada, no comentes: ' +
              'devuelve únicamente la traducción.',
          },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation service failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error('Translation came back empty.');

    return NextResponse.json({ translated, target: language });
  } catch (error) {
    console.error('Error translating:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate.' },
      { status: 500 }
    );
  }
}
