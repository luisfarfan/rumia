export interface ClaimSource {
  title: string | null;
  url: string | null;
}

export interface ClaimVerification {
  id: string;
  claim: string;
  status: 'True' | 'False' | 'Inconclusive';
  explanation: string;
  sources: ClaimSource[];
}

export interface CapturedItem {
  id: string;
  rawInput: string;
  type: string;
  status: string;
  title: string | null;
  content: string | null;
  originalUrl: string | null;
  createdAt: string;
  category?: string | null;
  tags?: string[] | null;
  thumbnailUrl?: string | null;
  /** The source's own words, before the model rewrote them. */
  transcript?: string | null;
  /** ISO 639-1 code detected for the source. */
  language?: string | null;
  /** Why the item is incomplete, when it is. Null means nothing was missing. */
  issue?: string | null;
  verifications?: ClaimVerification[];
}

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Answer {
  answer: string;
  sources: ClaimSource[];
}

/** react-force-graph resolves string endpoints into node objects after the
 *  first simulation tick, so every read has to tolerate both shapes. */
export const endpointId = (end: string | GraphNode): string =>
  typeof end === 'string' ? end : end.id;
