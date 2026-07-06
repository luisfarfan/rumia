import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export class ChunkingService {
  /**
   * Splits a long text into smaller semantic chunks using a recursive character text splitter.
   */
  static async splitText(
    text: string,
    options: { chunkSize?: number; chunkOverlap?: number } = {}
  ): Promise<string[]> {
    const chunkSize = options.chunkSize ?? 1000;
    const chunkOverlap = options.chunkOverlap ?? 200;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });

    const docs = await splitter.createDocuments([text]);
    return docs.map((doc) => doc.pageContent);
  }
}
