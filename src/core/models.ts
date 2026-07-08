export type CaptureStatus =
  | 'received'
  | 'queued'
  | 'inspecting'
  | 'extracting'
  | 'downloading'
  | 'transcribing'
  | 'normalizing'
  | 'enriching'
  | 'verifying'
  | 'indexing'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'processed'
  | 'error'
  | 'extracted'
  | 'chunked_and_embedded'
  | 'graph_extracted';

export interface CapturedFile {
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

export interface CaptureRequest {
  userId: string;
  sourceChannel: string;
  url?: string;
  text?: string;
  files?: CapturedFile[];
  note?: string;
  receivedAt: Date;
}

export interface CapturedItem {
  id: string;
  userId: string;
  originalUrl?: string;
  rawInput: string;
  sourceChannel: string;
  detectedSource?: string;
  status: CaptureStatus;
  content?: string;
  title?: string;
  description?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  error?: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}
