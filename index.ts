// :copyright: Copyright (c) 2023 ftrack
// A node.js script to convert our query_schema to TypeScript types
// TODO: Change type to module in API
import type {
  QuerySchemasResponse,
  QueryServerInformationResponse,
} from "@ftrack/api";
import { Session } from "@ftrack/api";
import * as fs from "fs";
import * as path from "path";
import prettier from "prettier";
import { convertSchemaToInterface } from "./convertSchemaToInterface";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const sessionServer = process.env.FTRACK_SERVER ?? "";
const session = new Session(
  sessionServer,
  process.env.FTRACK_API_USER ?? "",
  process.env.FTRACK_API_KEY ?? ""
);
const legacySchemas = ["Conversation", "Message", "Participant"];

async function main() {
  // Get the schemas from the server and sort by id in alphabetical order
  const schemas = await getSchemas();
  // For each schema in schemas, convert it to a TypeScript interface and add to a string
  const errors: any[] = [];
  let interfaces = "";
  for (const schema of schemas[0]) {
    if (legacySchemas.includes(schema.id)) return;
    const { TSInterface, conversionErrors } = await convertSchemaToInterface(
      schema,
      schemas
    );
    errors.push(conversionErrors);
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
  const date = new Date().toISOString();
  const serverVersion = (await getServerVersion())[0].version; // Will show dev if generating from localhost
  const preamble = `// :copyright: Copyright (c) 2023 ftrack \n\n// Generated on ${date} using schema \n// from an instance running version ${serverVersion} using server on ${sessionServer} \n// Not intended to modify manually\n\n`;
  // Write the file, adding the preamble first and the errors to the end of the file

  // Hack to get around the fact that the API doesn't return the correct type for BasicLink
  // Task: https://dev.ftrackapp.com/#slideEntityId=95e02be2-c7ec-11ed-ae64-46416ff77027&slideEntityType=task&view=tasks&itemId=projects&entityId=2465912c-2441-11ed-8edb-9e89dc32fb4f&entityType=task
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
  fs.mkdirSync(path.join(__dirname, "__output__"), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, "__output__", "schema.ts"),
    prettifiedContent
  );
}

async function getSchemas() {
  const schemas = await session.call<QuerySchemasResponse>([
    {
      action: "query_schemas",
    },
  ]);
  schemas[0].sort((a, b) => (a.id > b.id ? 1 : -1));
  return schemas;
}
async function getServerVersion() {
  let serverVersion = await session.call<QueryServerInformationResponse>([
    {
      action: "query_server_information",
      values: ["version"],
    },
  ]);
  return serverVersion;
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
main();
