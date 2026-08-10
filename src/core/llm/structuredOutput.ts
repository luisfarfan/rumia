/**
 * Helpers for getting structured output out of providers that ignore
 * `response_format`.
 *
 * cliproxyapi accepts OpenAI's `json_schema` response format and then answers in
 * Markdown anyway, so `JSON.parse` fails on text like `**Category**: Tutorial`.
 * The old code also cast the parse result with `as T` without validating, so a
 * well-formed JSON of the wrong shape would have flowed downstream unnoticed.
 *
 * The strategy here: ask for JSON in the prompt as well as the response format,
 * extract it tolerantly, and validate against the caller's Zod schema.
 */

interface ZodLike<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: unknown };
}

function isZodLike<T>(schema: unknown): schema is ZodLike<T> {
  return typeof (schema as ZodLike<T> | undefined)?.safeParse === 'function';
}

/**
 * Renders the instruction appended to the user prompt. Embeds the JSON Schema
 * when it can be derived, since naming the exact keys measurably beats asking
 * for "valid JSON".
 */
export function structuredInstruction(jsonSchema: unknown): string {
  const shape = jsonSchema ? `\n\nEsquema JSON requerido:\n${JSON.stringify(jsonSchema)}` : '';
  return (
    'Responde ÚNICAMENTE con un objeto JSON válido que cumpla el esquema. ' +
    'Sin texto antes ni después, sin explicaciones, sin bloques de código Markdown.' +
    shape
  );
}

/**
 * Pulls the first complete JSON object out of a model response.
 *
 * Handles the two shapes models actually return when they ignore the response
 * format: a fenced ```json block, or an object embedded in prose. Brace counting
 * skips over braces inside string literals so a `{` in a tag value cannot end the
 * scan early.
 */
export function extractJsonObject(text: string): string | null {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const haystack = fenced?.[1]?.trim() || text;

  const start = haystack.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < haystack.length; i++) {
    const char = haystack[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return haystack.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Extracts, parses and validates a model response. Throws with the offending
 * text when it cannot — a caller must never receive an unvalidated object typed
 * as if it had been checked.
 */
export function parseStructured<T>(text: string, schema: unknown): T {
  const candidate = extractJsonObject(text);
  if (!candidate) {
    throw new Error(`No JSON object found in model response: ${text.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    throw new Error(
      `Model response is not valid JSON (${err instanceof Error ? err.message : String(err)}): ${candidate.slice(0, 200)}`
    );
  }

  if (!isZodLike<T>(schema)) {
    // No schema to check against: the shape is the caller's problem, but at
    // least the JSON is real.
    return parsed as T;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Model response does not match the schema: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }
  return result.data;
}

/** The follow-up turn used to give the model one chance to correct itself. */
export function repairInstruction(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Tu respuesta anterior no se pudo usar: ${detail}\nRespóndela de nuevo como un único objeto JSON válido, sin ningún otro texto.`;
}
