import { NextResponse } from 'next/server';
import { dbPool } from '@/lib/db';

// Route Handlers are uncached by default in Next 16, so no `dynamic` opt-out is
// needed here.
/** Retrieval plus synthesis takes longer than the default budget. */
export const maxDuration = 120;

/**
 * Asks the knowledge base a question, from the dashboard.
 *
 * This deliberately does not import the worker's RagService: that module lives
 * outside the Next root and its ESM `.js` specifiers do not resolve through the
 * bundler. Rather than bend the build, the route talks to the same two services
 * the backend talks to — the embedding endpoint and the chat endpoint — over
 * their HTTP APIs, and runs the same pgvector query. The board's own search box
 * filters titles already on screen; this searches meaning across everything.
 */

interface ChunkRow {
  content: string;
  title: string | null;
  originalUrl: string | null;
}

async function embed(question: string): Promise<number[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_EMBEDDING_MODEL;
  if (!baseUrl || !model) {
    throw new Error('OLLAMA_BASE_URL and OLLAMA_EMBEDDING_MODEL must be configured to search.');
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: [question] }),
  });
  if (!response.ok) {
    throw new Error(`Embedding service failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: { embedding: number[] }[] };
  const vector = payload.data?.[0]?.embedding;
  if (!vector) throw new Error('Embedding service returned no vector for the question.');
  return vector;
}

async function synthesize(question: string, context: string): Promise<string> {
  const baseUrl = process.env.CLIPROXY_BASE_URL;
  const model = process.env.CLIPROXY_FLASH_MODEL;
  if (!baseUrl || !model) {
    throw new Error('CLIPROXY_BASE_URL and CLIPROXY_FLASH_MODEL must be configured to answer.');
  }

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
            'Responde la pregunta usando ÚNICAMENTE el contexto. Si el contexto no alcanza, dilo ' +
            'claramente en vez de inventar. Responde en el idioma de la pregunta, en Markdown breve.',
        },
        { role: 'user', content: `Contexto:\n${context}\n\nPregunta: ${question}` },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Chat service failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function POST(request: Request) {
  try {
    const { question } = (await request.json()) as { question?: string };
    if (!question?.trim()) {
      return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
    }

    const vector = await embed(question.trim());

    const { rows } = await dbPool.query<ChunkRow>(
      `SELECT ic.content, ci.title, ci.original_url AS "originalUrl"
         FROM item_chunks ic
         JOIN captured_items ci ON ci.id = ic.item_id
        ORDER BY ic.embedding <=> $1::vector ASC
        LIMIT 6`,
      [`[${vector.join(',')}]`]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        answer: 'Todavía no hay nada vectorizado que responda a esa pregunta.',
        sources: [],
      });
    }

    const context = rows
      .map((row, index) => `[Fuente ${index + 1}] ${row.content}`)
      .join('\n\n');

    const answer = await synthesize(question.trim(), context);

    // Deduplicated by URL so one long article does not fill the citation list.
    const sources = [
      ...new Map(
        rows
          .filter((row) => row.originalUrl)
          .map((row) => [row.originalUrl, { title: row.title, url: row.originalUrl }])
      ).values(),
    ];

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error('Error answering question:', error);
    // Surfaced rather than swallowed: an empty answer would read as "nothing
    // found" when the real cause is a service being unreachable.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer the question.' },
      { status: 500 }
    );
  }
}
