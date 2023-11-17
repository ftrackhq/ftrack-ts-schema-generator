import type { QuerySchemasResponse, Session } from "@ftrack/api";
import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";
import { convertSchemaToInterface } from "./convertSchemaToInterface.js";

const legacySchemas = ["Conversation", "Message", "Participant"];
export async function emitToFile(
  session: Session,
  outputPath = "__generated__",
  outputFilename = "schema.ts"
) {
  // Get the schemas from the server and sort by id in alphabetical order
  const schemas = await getSchemas(session);

  const {
    prettifiedContent,
    errors,
  }: { prettifiedContent: string; errors: unknown[] } = await emitToString(
    session.serverVersion,
    session.serverUrl,
    schemas
  );
  fs.mkdirSync(path.resolve(outputPath), { recursive: true });
  fs.writeFileSync(path.join(outputPath, outputFilename), prettifiedContent);

  return { errors, schemas };
}

export async function emitToString(
  serverVersion: string | undefined,
  serverUrl: string | undefined,
  schemas: QuerySchemasResponse[]
) {
  const date = new Date().toISOString();
  const preamble = `// :copyright: Copyright (c) 2023 ftrack \n\n// Generated on ${date} using schema \n// from an instance running version ${serverVersion} using server on ${serverUrl} \n// Not intended to modify manually\n\n`;

  const errors: unknown[] = [];
  
  if(schemas.length < 1) {
    errors.push('No schemas found!');
    return;
  }

  // For each schema in schemas, convert it to a TypeScript interface and add to a string
  let interfaces = "";
  for (const schema of schemas[0]) {
    if (legacySchemas.includes(schema.id)) {
      continue;
    }

    const { TSInterface, conversionErrors } = await convertSchemaToInterface(
      schema,
      schemas
    );
    errors.push(...conversionErrors);
    interfaces += TSInterface;
  }

  // Add a map of entity types and type for EntityType and a type for EntityData
  const schemaNames = schemas[0]
    .map((s) => s.id)
    .map((name) => `${name}: ${name};`);
  const entityTypeMap = `export interface EntityTypeMap {${schemaNames.join(
    "\n"
  )}}`;
  const entityType = `export type EntityType = keyof EntityTypeMap;`;
  const entityData = `export type EntityData<TEntityType extends EntityType = EntityType> =
    EntityTypeMap[TEntityType];`;
  // Add a map of TypedContext subtypes and type for TypedContextSubtype
  const { TypedContextSubtypeMap, TypedContextSubtype } =
    getTypedContextTypes(schemas);
  // Write the file, adding the preamble first and the errors to the end of the file
  // Hack to get around the fact that the API doesn't return the correct type for BasicLink
  // Task: 95e02be2-c7ec-11ed-ae64-46416ff77027
  interfaces = AddBasicLinkType(interfaces);
  // End of hack
  // Prettify
  const allContent =
    preamble +
    interfaces +
    entityTypeMap +
    entityType +
    entityData +
    TypedContextSubtypeMap +
    TypedContextSubtype +
    "\n \n// Errors: \n" +
    errors.join("\n");
  const prettifiedContent = prettier.format(allContent, {
    parser: "typescript",
  });
  return { prettifiedContent, errors };
}

async function getSchemas(session: Session) {
  const schemas = await session.call<QuerySchemasResponse>([
    {
      action: "query_schemas",
    },
  ]);
  schemas[0].sort((a, b) => (a.id > b.id ? 1 : -1));
  return schemas;
}

function AddBasicLinkType(interfaces: string) {
  const regex = /link\?:\s*string/gi;
  const modifiedInterfaces = interfaces.replace(regex, "link?: BasicLink[]");
  return `${modifiedInterfaces} export interface BasicLink {
    id: string;
    type: string;
    name: string;
  };`;
}
function getTypedContextTypes(schemas: QuerySchemasResponse[]) {
  const typedContextNames = schemas[0]
    .filter(
      (schema) =>
        (typeof schema?.alias_for === "object" &&
          schema.alias_for.id === "Task") ||
        schema.id === "TypedContext"
    )
    .map((s) => s.id)
    .map((name) => `${name}: ${name};`);
  const TypedContextSubtypeMap = `export interface TypedContextSubtypeMap {${typedContextNames.join(
    "\n"
  )}}`;
  const TypedContextSubtype = `export type TypedContextSubtype = keyof TypedContextSubtypeMap;`;
  return { TypedContextSubtypeMap, TypedContextSubtype };
}
