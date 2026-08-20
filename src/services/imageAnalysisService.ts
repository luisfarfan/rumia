import { LLMFactory } from '../core/llm/LLMFactory.js';
import type { UsageMeta } from '../core/llm/types.js';

const SYSTEM_PROMPT = `Eres un analizador visual preciso para una wiki de conocimiento personal.
Tu trabajo tiene dos partes y ambas son obligatorias:
1. TRANSCRIBIR al pie de la letra todo el texto que aparezca escrito en las imágenes.
2. DESCRIBIR lo que se ve: diagramas, capturas de pantalla, código, personas, productos, gráficos.
Escribe tu descripción en el MISMO IDIOMA que el texto de las imágenes; si no tienen
texto, usa el idioma del contexto que acompaña. Nunca traduzcas: la traducción es una
acción aparte que el lector pide cuando la quiere. Responde en Markdown. Si una imagen
no contiene texto, dilo explícitamente en vez de inventarlo.`;

/**
 * Reads a set of images with the vision tier.
 *
 * This is the project's OCR: a vision model transcribes on-screen text as well as
 * a dedicated OCR engine would for this kind of content, and it describes the
 * image in the same pass — verified against a real TikTok carousel, where it
 * transcribed each slide literally.
 *
 * Throws when the vision call fails. Callers decide how to degrade; what they may
 * not do is store the error as if it were content.
 */
export class ImageAnalysisService {
  static async analyze(
    imagePaths: string[],
    context: { title?: string; caption?: string; kind: 'carrusel' | 'imagen'; usageMeta?: UsageMeta }
  ): Promise<string> {
    if (imagePaths.length === 0) {
      throw new Error('ImageAnalysisService.analyze called with no images.');
    }

    const partes = [
      context.kind === 'carrusel'
        ? `Estas son ${imagePaths.length} diapositivas consecutivas de un carrusel. Analízalas en orden.`
        : 'Analiza la siguiente imagen.',
    ];
    if (context.title) partes.push(`Título: "${context.title}"`);
    if (context.caption) partes.push(`Texto que la acompaña: "${context.caption}"`);

    return LLMFactory.getChatProvider().generateCompletion(partes.join('\n'), {
      modelTier: 'vision',
      systemPrompt: SYSTEM_PROMPT,
      imagePaths,
      ...(context.usageMeta ? { usageMeta: context.usageMeta } : {}),
    });
  }
}
