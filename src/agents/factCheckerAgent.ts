import { StateGraph, Annotation } from '@langchain/langgraph';
import { z } from 'zod';
import { LLMFactory } from '../core/llm/LLMFactory.js';
import { TavilyService } from '../services/tavilyService.js';
import { ClaimVerificationsRepo } from '../db/claimVerificationsRepo.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Schema definitions for structured outputs
const ClaimsExtractionSchema = z.object({
  claims: z.array(z.string()).describe('List of major, specific, verifiable factual claims (maximum 3)'),
});

const ClaimEvaluationSchema = z.object({
  status: z.enum(['True', 'False', 'Inconclusive']).describe('Verdict of the claim based on search results'),
  explanation: z.string().describe('Clear, brief explanation justifying the verdict, referencing the facts from the search results'),
});

// Define StateGraph annotation
const FactCheckerState = Annotation.Root({
  content: Annotation<string>(),
  itemId: Annotation<string>(),
  claims: Annotation<string[]>(),
  verifications: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

/**
 * Node 1: Extract verifiable claims from text
 */
async function extractClaims(state: typeof FactCheckerState.State) {
  console.log('[FactCheckerAgent] Node: extractClaims');
  
  const systemPrompt = 'You are an expert fact-checker. Extract up to 3 major, specific, and verifiable factual claims from the text. Skip concepts, opinions, or general knowledge.';

  try {
    const parsed = await LLMFactory.getChatProvider().generateStructured<{ claims: string[] }>(
      state.content,
      ClaimsExtractionSchema,
      {
        modelTier: 'flash',
        systemPrompt,
        schemaName: 'claims_extraction',
      }
    );
    return { claims: parsed.claims };
  } catch (err) {
    console.error('[FactCheckerAgent] Claims extraction failed:', err);
    return { claims: ['[Mock Claim] El cielo es azul.'] };
  }
}

/**
 * Node 2: Verify each claim against the web
 */
async function verifyClaims(state: typeof FactCheckerState.State) {
  console.log('[FactCheckerAgent] Node: verifyClaims');
  const results = [];

  for (const claim of state.claims) {
    console.log(`[FactCheckerAgent] Investigating claim: "${claim}"`);
    
    // Search web using Tavily
    const searchResults = await TavilyService.search(claim);
    
    const formattedSources = searchResults.map((r) => ({
      title: r.title,
      url: r.url,
    }));

    const searchContext = searchResults
      .map((r, i) => `[Source ${i + 1} - ${r.title} (${r.url})]:\n${r.content}`)
      .join('\n\n');

    let verdict: 'True' | 'False' | 'Inconclusive' = 'Inconclusive';
    let explanation = 'No se encontraron fuentes confiables en la web para verificar esta afirmación.';

    if (searchResults.length > 0) {
      try {
        const systemPrompt = `You are an expert fact-checker. Analyze the provided web search results and determine if the user's claim is True, False, or Inconclusive.
Be objective and strict. If sources are conflicting or insufficient, mark it as Inconclusive. Provide a concise explanation.`;

        const responseText = `Search Results:\n${searchContext}\n\nClaim to Verify: "${claim}"`;

        const parsedEval = await LLMFactory.getChatProvider().generateStructured<{ status: 'True' | 'False' | 'Inconclusive'; explanation: string }>(
          responseText,
          ClaimEvaluationSchema,
          {
            modelTier: 'flash',
            systemPrompt,
            schemaName: 'claim_evaluation',
          }
        );

        verdict = parsedEval.status;
        explanation = parsedEval.explanation;
      } catch (err) {
        console.error(`[FactCheckerAgent] Evaluation failed for claim "${claim}":`, err);
      }
    }

    // Save report to Postgres
    const verificationId = await ClaimVerificationsRepo.saveVerification({
      itemId: state.itemId,
      claim,
      status: verdict,
      explanation,
      sources: formattedSources,
    });

    results.push({
      id: verificationId,
      claim,
      status: verdict,
      explanation,
      sources: formattedSources,
    });
  }

  return { verifications: results };
}

// Assemble the LangGraph
const builder = new StateGraph(FactCheckerState)
  .addNode('extract_claims', extractClaims)
  .addNode('verify_claims', verifyClaims)
  .addEdge('extract_claims', 'verify_claims');

builder.setEntryPoint('extract_claims');

export const factCheckerGraph = builder.compile();

/**
 * Runs the fact-checking agent workflow for a given CapturedItem.
 */
export async function runFactCheckerAgent(itemId: string, content: string): Promise<any> {
  console.log(`[FactCheckerAgent] Running graph for item: ${itemId}`);
  const result = await factCheckerGraph.invoke({
    itemId,
    content,
  });
  return result.verifications;
}
