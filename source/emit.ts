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
  const customAttributes = await getCustomAttributes(session);
  const types = await getTypes(session);
  const objectTypes = await getObjectTypes(session);
  const projectSchemas = await getProjectSchemas(session);

  const {
    prettifiedContent,
    errors,
  }: { prettifiedContent: string; errors: unknown[] } = await emitToString(
    session.serverVersion,
    session.serverUrl,
    schemas,
    customAttributes,
    types,
    objectTypes,
    projectSchemas
  );
  fs.mkdirSync(path.resolve(outputPath), { recursive: true });
  fs.writeFileSync(path.join(outputPath, outputFilename), prettifiedContent);

  return { errors, schemas };
}

export type Type = {
  __entity_type__: "Type";
  id: string;
  name: string;
  color: string;
  is_billable: boolean;
  task_type_schemas: Array<{
    __entity_type__: "TaskTypeSchema";
    id: string;
  }>;
  tasks: Array<{
    __entity_type__: string;
    id: string;
    context_type: string;
    object_type_id: string;
    project_id: string;
  }>;
};

export type ProjectSchema = {
  __entity_type__: "ProjectSchema";
  id: string;
  object_types: Array<{
    __entity_type__: "ObjectType";
    id: string;
  }>;
  name: string;
  task_templates: Array<{
    __entity_type__: "TaskTemplate";
    id: string;
  }>;
  object_type_schemas: Array<{
    __entity_type__: "Schema";
    id: string;
  }>;
};

export type ObjectType = {
  id: string;
  name: string;
  is_time_reportable: boolean;
  is_taskable: boolean;
  is_typeable: boolean;
  is_statusable: boolean;
  is_schedulable: boolean;
  is_prioritizable: boolean;
  is_leaf: boolean;
};

export type CustomAttributeConfiguration = {
  __entity_type__: "CustomAttributeConfiguration";
  id: string;
  object_type: {
    __entity_type__: "ObjectType";
    id: string;
    name: string;
  };
  default: unknown;
  key: string;
  entity_type: string;
  label: string;
  project_id: string | null;
  is_hierarchical: boolean;
  values: [];
};

export async function emitToString(
  serverVersion: string | undefined,
  serverUrl: string | undefined,
  schemas: QuerySchemasResponse,
  customAttributes: CustomAttributeConfiguration[],
  types: Type[],
  objectTypes: ObjectType[],
  projectSchemas: ProjectSchema[]
) {
  const preamble = `// :copyright: Copyright (c) ${new Date().getFullYear()} ftrack \n\n// Generated on ${new Date().toISOString()} using schema \n// from an instance running version ${serverVersion} using server on ${serverUrl} \n// Not intended to modify manually\n\n`;

  const errors: unknown[] = [];

  if (schemas.length < 1) {
    errors.push("No schemas found!");
    return {
      prettifiedContent: "",
      errors,
    };
  }

  // For each schema in schemas, convert it to a TypeScript interface and add to a string
  let interfaces = "";
  for (const schema of schemas) {
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

  const typesString = `
    export function getTypes() {
      return [
        ${types.map(
          (x) => `{
          name: "${x.name}",
          isBillable: ${x.is_billable}
        }`
        )}
      ] as const;
    }

    export type RuntimeType = ReturnType<typeof getTypes>[number];
    export type RuntimeTypeName = RuntimeType["name"];
  `;

  const objectTypesString = `
    export function getObjectTypes() {
      return [
        ${objectTypes.map(
          (x) => `{
          name: "${x.name}",
          isTimeReportable: ${x.is_time_reportable},
          isTaskable: ${x.is_taskable},
          isTypeable: ${x.is_typeable},
          isStatusable: ${x.is_statusable},
          isSchedulable: ${x.is_schedulable},
          isPrioritizable: ${x.is_prioritizable},
          isLeaf: ${x.is_leaf},
        }`
        )}
      ] as const;
    }

    export type RuntimeObjectType = ReturnType<typeof getObjectTypes>[number];
    export type RuntimeObjectTypeName = RuntimeObjectType["name"];
`;

  const customAttributesString = `
    export function getAttributeConfigurations() {
      return [
        ${customAttributes.map(
          (x) => `{
            name: "${x.key}",
            label: "${x.label}",
            entityType: "${x.entity_type}",
            default: ${JSON.stringify(x.default)},
            objectType: ${JSON.stringify(x.object_type?.name)},
            isHierarchical: ${x.is_hierarchical}
          }`
        )}
      ] as const;
    }
    
    export type RuntimeCustomAttributeConfiguration = ReturnType<typeof getAttributeConfigurations>[number];
    export type RuntimeCustomAttributeConfigurationName = RuntimeCustomAttributeConfiguration["name"];
    export type RuntimeCustomAttributeConfigurationLabel = RuntimeCustomAttributeConfiguration["label"];
  `;

  const projectSchemasString = `
    export function getProjectSchemas() {
      return [
        ${projectSchemas.map(
          (x) => `{
            name: "${x.name}",
            objectTypes: [
              ${x.object_types
                .map((t) => objectTypes.find((x) => x.id === t.id))
                .map((t) => `"${t?.name}"`)
                .join(", ")}
            ]
          }`
        )}
      ] as const;
    }

    export type RuntimeProjectSchema = ReturnType<typeof getProjectSchemas>[number];
    export type RuntimeProjectSchemaName = RuntimeProjectSchema["name"];
  `;

  // Add a map of entity types and type for EntityType and a type for EntityData
  const schemaNames = schemas
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
    customAttributesString +
    typesString +
    objectTypesString +
    projectSchemasString +
    "\n \n// Errors: \n" +
    errors.map((error) => `// ${error}`).join("\n");
  const prettifiedContent = prettier.format(allContent, {
    parser: "typescript",
  });
  return { prettifiedContent, errors };
}

async function getCustomAttributes(session: Session) {
  const customAttributes = await session.query<CustomAttributeConfiguration>(
    "select default, label, key, project_id, entity_type, is_hierarchical, object_type.name from CustomAttributeConfiguration order by sort"
  );
  return customAttributes.data;
}

async function getSchemas(session: Session) {
  const schemas = await session.call<QuerySchemasResponse>([
    {
      action: "query_schemas",
    },
  ]);
  schemas[0].sort((a, b) => (a.id > b.id ? 1 : -1));
  return schemas[0];
}

async function getTypes(session: Session) {
  const types = await session.query<Type>(
    "select color, is_billable, name, task_type_schemas, tasks from Type order by sort"
  );
  return types.data;
}

async function getObjectTypes(session: Session) {
  const objectTypes = await session.query<ObjectType>(
    "select id, is_leaf, is_prioritizable, is_schedulable, is_statusable, is_taskable, is_time_reportable, is_typeable, name, project_schemas, tasks from ObjectType order by sort"
  );
  return objectTypes.data;
}

async function getProjectSchemas(session: Session) {
  const projectSchemas = await session.query<ProjectSchema>(
    "select name, asset_version_workflow_schema, name, object_type_schemas, object_types, task_templates, task_type_schema, task_workflow_schema, task_workflow_schema_overrides from ProjectSchema"
  );
  return projectSchemas.data;
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
function getTypedContextTypes(schemas: QuerySchemasResponse) {
  const typedContextNames = schemas
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
