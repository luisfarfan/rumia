import { StateGraph, Annotation } from '@langchain/langgraph';
import { LLMFactory } from '../core/llm/LLMFactory.js';
import { audioTranscriptionHandler } from '../workers/ingestion/handlers/audioTranscriptionHandler.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Define LangGraph state for the Ingestion Agent
const IngestionAgentState = Annotation.Root({
  url: Annotation<string>(),
  itemId: Annotation<string>(),
  title: Annotation<string>(),
  duration: Annotation<number>(),
  subtitlesText: Annotation<string | null>(),
  audioPath: Annotation<string | null>(),
  framePaths: Annotation<string[]>(),
  audioTranscript: Annotation<string | null>(),
  visualAnalysis: Annotation<string | null>(),
  visualAnalysisFailed: Annotation<boolean>(),
  transcriptionFailed: Annotation<boolean>(),
  synthesizedContent: Annotation<string | null>(),
});

/**
 * Node 1: Transcribe audio or use VTT subtitles
 */
async function transcribeAudio(state: typeof IngestionAgentState.State) {
  console.log('[IngestionAgent] Node: transcribeAudio');
  
  if (state.subtitlesText) {
    console.log('[IngestionAgent] Using pre-fetched VTT subtitles.');
    return { audioTranscript: state.subtitlesText };
  }

  if (state.audioPath) {
    console.log('[IngestionAgent] Transcribing downloaded audio file...');
    try {
      const result = await audioTranscriptionHandler(state.audioPath);
      return { audioTranscript: result.content, transcriptionFailed: false };
    } catch (err) {
      // Same rule as the vision node: never hand the error text downstream as if
      // it were speech. A silent clip is also a legitimate outcome here — the
      // visual analysis alone can still be a useful entry.
      console.error('[IngestionAgent] Transcription failed:', err);
      return { audioTranscript: null, transcriptionFailed: true };
    }
  }

  return { audioTranscript: null, transcriptionFailed: false };
}

/**
 * Node 2: Analyze keyframes using Vision model
 */
async function analyzeFrames(state: typeof IngestionAgentState.State) {
  console.log('[IngestionAgent] Node: analyzeFrames');

  if (!state.framePaths || state.framePaths.length === 0) {
    console.log('[IngestionAgent] No keyframes to analyze.');
    return { visualAnalysis: null, visualAnalysisFailed: false };
  }

  console.log(`[IngestionAgent] Analyzing ${state.framePaths.length} keyframes via Vision LLM...`);
  
  const systemPrompt = `You are a visual video analyzer. Review the series of keyframes extracted chronologically from the video.
Describe exactly what happens visually in the video: slides, screen shares, code blocks, people, diagrams, and actions.
Produce a structured visual timeline.`;

  const userPrompt = `Here are the chronological keyframes from the video titled "${state.title}". Please summarize the visual content step by step.`;

  try {
    const visualAnalysis = await LLMFactory.getChatProvider().generateCompletion(userPrompt, {
      modelTier: 'vision',
      systemPrompt,
      imagePaths: state.framePaths,
      usageMeta: {
        flow: 'web_extraction',
        itemId: state.itemId,
      },
    });

    console.log('[IngestionAgent] Visual analysis complete.');
    return { visualAnalysis, visualAnalysisFailed: false };
  } catch (err) {
    // Never hand the error text downstream: it used to be written into the wiki
    // entry as if it were content, get categorized, embedded and pushed into the
    // graph — so a broken vision tier looked like a successfully ingested item.
    console.error('[IngestionAgent] Vision analysis failed:', err);
    return { visualAnalysis: null, visualAnalysisFailed: true };
  }
}

/**
 * Node 3: Synthesize transcription and visual summaries into final wiki content
 */
async function synthesizeKnowledge(state: typeof IngestionAgentState.State) {
  console.log('[IngestionAgent] Node: synthesizeKnowledge');

  const systemPrompt = `You are an expert technical writer and knowledge base synthesizer.
Your goal is to write a highly detailed, comprehensive, and beautiful Markdown document for a personal knowledge wiki.
Combine the audio transcript and the visual timeline analysis into a single, cohesive, self-contained wiki page.
Include sections like Introduction, Key Concepts, Visual Walkthrough, Summary, and Key Takeaways.`;

  // Omit the visual section entirely when there is no analysis, rather than
  // passing a placeholder the model would paraphrase into the entry.
  const visualSection = state.visualAnalysis
    ? `=== VISUAL TIMELINE ANALYSIS ===\n${state.visualAnalysis}\n\n`
    : '';
  const transcriptSection = state.audioTranscript
    ? `=== AUDIO TRANSCRIPT / SUBTITLES ===\n${state.audioTranscript}\n\n`
    : '';

  const userPrompt = `Video Title: "${state.title}"
Duration: ${state.duration} seconds
URL: ${state.url}

${visualSection}${transcriptSection}Please synthesize the above content into a final, detailed wiki entry in Markdown.`;

  try {
    const synthesizedContent = await LLMFactory.getChatProvider().generateCompletion(userPrompt, {
      modelTier: 'pro',
      systemPrompt,
      usageMeta: {
        flow: 'web_extraction',
        itemId: state.itemId,
      },
    });

    console.log('[IngestionAgent] Knowledge synthesis complete.');
    return { synthesizedContent };
  } catch (err) {
    // Same rule as the vision node: keep the material we actually have, and keep
    // the error out of the stored content.
    console.error('[IngestionAgent] Synthesis failed:', err);
    return {
      synthesizedContent: `# ${state.title}\n\n${state.audioTranscript ?? ''}`.trim(),
    };
  }
}

// Assemble the LangGraph
const builder = new StateGraph(IngestionAgentState)
  .addNode('transcribe_audio', transcribeAudio)
  .addNode('analyze_frames', analyzeFrames)
  .addNode('synthesize_knowledge', synthesizeKnowledge)
  .addEdge('__start__', 'transcribe_audio')
  .addEdge('__start__', 'analyze_frames')
  .addEdge('transcribe_audio', 'synthesize_knowledge')
  .addEdge('analyze_frames', 'synthesize_knowledge')
  .addEdge('synthesize_knowledge', '__end__');

export const ingestionGraph = builder.compile();

/**
 * Runs the LangGraph-based ingestion agent to extract and synthesize video content.
 */
export async function runIngestionAgent(params: {
  url: string;
  itemId: string;
  title: string;
  duration: number;
  subtitlesText: string | null;
  audioPath: string | null;
  framePaths: string[];
}): Promise<{ title: string; content: string; visualAnalysisFailed: boolean; transcriptionFailed: boolean }> {
  console.log(`[IngestionAgent] Running LangGraph for: "${params.title}"`);

  const result = await ingestionGraph.invoke({
    url: params.url,
    itemId: params.itemId,
    title: params.title,
    duration: params.duration,
    subtitlesText: params.subtitlesText,
    audioPath: params.audioPath,
    framePaths: params.framePaths,
  });

  return {
    title: params.title,
    content: result.synthesizedContent || '',
    visualAnalysisFailed: result.visualAnalysisFailed === true,
    transcriptionFailed: result.transcriptionFailed === true,
  };
}
