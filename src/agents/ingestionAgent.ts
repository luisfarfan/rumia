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
      return { audioTranscript: result.content };
    } catch (err) {
      console.error('[IngestionAgent] Transcription failed:', err);
      return { audioTranscript: `[Error transcribiendo audio: ${err instanceof Error ? err.message : String(err)}]` };
    }
  }

  return { audioTranscript: 'No audio or subtitles available.' };
}

/**
 * Node 2: Analyze keyframes using Vision model
 */
async function analyzeFrames(state: typeof IngestionAgentState.State) {
  console.log('[IngestionAgent] Node: analyzeFrames');

  if (!state.framePaths || state.framePaths.length === 0) {
    console.log('[IngestionAgent] No keyframes to analyze.');
    return { visualAnalysis: 'No visual frames available.' };
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
    return { visualAnalysis };
  } catch (err) {
    console.error('[IngestionAgent] Vision analysis failed:', err);
    return { visualAnalysis: `[Error analizando fotogramas: ${err instanceof Error ? err.message : String(err)}]` };
  }
}

/**
 * Node 3: Synthesize transcription and visual summaries into final wiki content
 */
async function synthesizeKnowledge(state: typeof IngestionAgentState.State) {
  console.log('[IngestionAgent] Node: synthesizeKnowledge');

  const systemPrompt = `You are an expert technical writer and knowledge base synthesizer.
Your goal is to write a highly detailed, comprehensive, and beautiful Markdown document for an autodiscovery knowledge wiki.
Combine the audio transcript and the visual timeline analysis into a single, cohesive, self-contained wiki page.
Include sections like Introduction, Key Concepts, Visual Walkthrough, Summary, and Key Takeaways.`;

  const userPrompt = `Video Title: "${state.title}"
Duration: ${state.duration} seconds
URL: ${state.url}

=== VISUAL TIMELINE ANALYSIS ===
${state.visualAnalysis}

=== AUDIO TRANSCRIPT / SUBTITLES ===
${state.audioTranscript}

Please synthesize the above content into a final, detailed wiki entry in Markdown.`;

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
    console.error('[IngestionAgent] Synthesis failed:', err);
    return {
      synthesizedContent: `# ${state.title}\n\nFailed to fully synthesize video content. Raw transcript below:\n\n${state.audioTranscript}`,
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
}): Promise<{ title: string; content: string }> {
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
  };
}
