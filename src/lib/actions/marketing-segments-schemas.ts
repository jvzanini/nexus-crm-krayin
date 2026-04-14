import { z } from "zod";

export const SEGMENT_OPERATORS = ["eq", "neq", "in", "gt", "lt", "contains"] as const;

export const segmentFilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(SEGMENT_OPERATORS),
  value: z.any(),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  filters: z.array(segmentFilterSchema).max(20),
});

export const updateSegmentSchema = createSegmentSchema.partial();

export const previewSegmentSchema = z.object({
  filters: z.array(segmentFilterSchema).max(20),
});
