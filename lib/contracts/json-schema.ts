/** Minimaler Zod→JSON-Schema-Konverter für Structured Outputs (Spec 05, FR-05-04). */
import { z } from 'zod';

export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const def = schema._def as { typeName?: string; [key: string]: unknown };
  const typeName = def.typeName as string | undefined;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'string', enum: [...(def.values as string[])] };
    case 'ZodLiteral':
      return { type: 'string', enum: [String(def.value)] };
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type as z.ZodTypeAny) };
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return zodToJsonSchema(def.innerType as z.ZodTypeAny);
    case 'ZodEffects':
      return zodToJsonSchema(def.schema as z.ZodTypeAny);
    case 'ZodRecord':
      return { type: 'object', additionalProperties: false };
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const child = value as z.ZodTypeAny;
        properties[key] = zodToJsonSchema(child);
        const childDef = child._def as { typeName?: string };
        if (childDef.typeName !== 'ZodOptional' && childDef.typeName !== 'ZodDefault') {
          required.push(key);
        }
      }
      return { type: 'object', properties, required, additionalProperties: false };
    }
    default:
      return { type: 'string' };
  }
}

/** OpenAI strict mode verlangt, dass alle Properties in `required` stehen. */
export function toStrictJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const js = zodToJsonSchema(schema);
  const makeStrict = (node: JsonSchema): JsonSchema => {
    if (node.type === 'object' && node.properties) {
      node.required = Object.keys(node.properties);
      node.additionalProperties = false;
      for (const child of Object.values(node.properties)) makeStrict(child);
    }
    if (node.items) makeStrict(node.items);
    return node;
  };
  return makeStrict(js);
}
