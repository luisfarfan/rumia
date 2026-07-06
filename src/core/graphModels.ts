import { z } from 'zod';

export const ExtractedNodeSchema = z.object({
  name: z.string().describe('The name of the entity, capitalized (e.g., Google, Elon Musk, San Francisco, Python)'),
  label: z.enum(['Person', 'Organization', 'Location', 'Technology', 'Event', 'Concept', 'Other'])
    .describe('The category label of the entity'),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({})
    .describe('Additional properties or facts about the entity'),
});

export const ExtractedEdgeSchema = z.object({
  source: z.string().describe('Name of the source entity'),
  target: z.string().describe('Name of the target entity'),
  type: z.string().describe('The relationship type connecting them, lowercase with underscores (e.g., CEO_of, located_in, works_at, created_by)'),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({})
    .describe('Additional properties about the relationship'),
});

export const GraphExtractionResultSchema = z.object({
  nodes: z.array(ExtractedNodeSchema),
  edges: z.array(ExtractedEdgeSchema),
});

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;
export type ExtractedEdge = z.infer<typeof ExtractedEdgeSchema>;
export type GraphExtractionResult = z.infer<typeof GraphExtractionResultSchema>;
