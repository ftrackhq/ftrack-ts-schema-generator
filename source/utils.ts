import type { Schema } from "@ftrack/api";

export function isSchemaTypedContext(schema: Schema) {
  return schema.id === "TypedContext";
}
