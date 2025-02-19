import { z } from 'zod';

export const StandardSchema = z.object({
  id: z.string(),
  nodeTitle: z.string(),
  nodeDescription: z.string(),
  metadata: z.object({
    source: z.enum(['common_core', 'texas_TEKS']),
    subjectName: z.string(),
    standardNotation: z.string(),
    depth: z.number()
  }),
  relationships: z.object({
    parentIds: z.array(z.string())
  })
});

export function validateStandard(standard: unknown) {
  return StandardSchema.parse(standard);
} 