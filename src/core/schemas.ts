import { z } from 'zod';

export const CapturedFileSchema = z.object({
  fileId: z.string(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
});

export const CaptureRequestSchema = z.object({
  userId: z.string(),
  sourceChannel: z.string(),
  url: z.string().url().optional(),
  text: z.string().optional(),
  files: z.array(CapturedFileSchema).optional(),
  note: z.string().optional(),
  receivedAt: z.coerce.date().default(() => new Date()),
});

export const CaptureStatusSchema = z.enum([
  'received',
  'queued',
  'inspecting',
  'extracting',
  'downloading',
  'transcribing',
  'normalizing',
  'enriching',
  'verifying',
  'indexing',
  'completed',
  'partially_completed',
  'failed',
  'processed',
  'error',
  'extracted',
  'chunked_and_embedded',
  'graph_extracted',
]);
