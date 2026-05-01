import { z } from "zod";

export const DataContractFieldSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "integer", "boolean", "date", "datetime", "json"]),
  nullable: z.boolean().default(false),
  description: z.string().optional(),
  example: z.unknown().optional(),
  constraints: z.object({
    minLength: z.number().int().optional(),
    maxLength: z.number().int().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.unknown()).optional(),
  }).optional(),
  pii: z.boolean().default(false),
  classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
});
export type DataContractField = z.infer<typeof DataContractFieldSchema>;

export const DataContractSchema = z.object({
  apiVersion: z.literal("financeos.io/v1"),
  kind: z.literal("DataContract"),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().default("finance"),
    version: z.string(),
    owner: z.string(),
    status: z.enum(["draft", "active", "deprecated"]),
  }),
  spec: z.object({
    description: z.string(),
    schema: z.object({
      fields: z.array(DataContractFieldSchema),
      primaryKey: z.array(z.string()),
      partitionBy: z.array(z.string()).default([]),
      sortBy: z.array(z.string()).default([]),
    }),
    sla: z.object({
      freshness: z.string(),
      completeness: z.number().min(0).max(1),
      accuracy: z.number().min(0).max(1).optional(),
    }),
    sources: z.array(
      z.object({
        system: z.string(),
        table: z.string(),
        grain: z.string(),
        transformScript: z.string().optional(),
      })
    ),
    consumers: z.array(
      z.object({
        team: z.string(),
        use: z.string(),
      })
    ).default([]),
  }),
});
export type DataContract = z.infer<typeof DataContractSchema>;
