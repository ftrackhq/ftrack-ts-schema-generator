import type { QuerySchemasResponse, Session } from "@ftrack/api";
import * as fs from "fs";
import * as path from "path";
import { emitSchemaInterface } from "./emitSchema.js";
import {
  CustomAttributeConfiguration,
  emitCustomAttributes,
} from "./emitCustomAttributes.js";
import { TypeScriptEmitter } from "./typescriptEmitter.js";

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
  const statuses = await getStatuses(session);
  const priorities = await getPriorities(session);

  const { prettifiedContent, errors } = await emitToString(
    session.serverVersion,
    session.serverUrl,
    schemas,
    customAttributes,
    types,
    objectTypes,
    projectSchemas,
    statuses,
    priorities
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

export type Priority = {
  color: string;
  id: string;
  name: string;
  sort: number;
  value: number;
};

export type Status = {
  color: string;
  id: string;
  is_active: boolean;
  name: string;
  sort: number;
};

export async function emitToString(
  serverVersion: string | undefined,
  serverUrl: string | undefined,
  schemas: QuerySchemasResponse,
  customAttributes: CustomAttributeConfiguration[],
  types: Type[],
  objectTypes: ObjectType[],
  projectSchemas: ProjectSchema[],
  statuses: Status[],
  priorities: Priority[]
) {
  const errors: unknown[] = [];

  if (schemas.length < 1) {
    errors.push("No schemas found!");
    return {
      prettifiedContent: "",
      errors,
    };
  }

  const emitter = new TypeScriptEmitter();
  emitter.appendCode(`
    // :copyright: Copyright (c) ${new Date().getFullYear()} ftrack
    // Generated on ${new Date().toISOString()} using schema
    // from an instance running version ${serverVersion} using server on ${serverUrl}
    // Not intended to modify manually
  `);

  // For each schema in schemas, convert it to a TypeScript interface and add to a string
  for (const schema of schemas) {
    if (legacySchemas.includes(schema.id)) {
      continue;
    }

    await emitSchemaInterface(emitter, schema, schemas);
  }

  emitter.appendCode(`
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
  `);

  emitter.appendCode(`
    export function getStatuses() {
      return [
        ${statuses.map(
          (x) => `{
          name: "${x.name}",
          color: "${x.color}",
          isActive: ${x.is_active},
          sort: ${x.sort}
        }`
        )}
      ] as const;
    }

    export type RuntimeStatus = ReturnType<typeof getStatuses>[number];
    export type RuntimeStatusName = RuntimeStatus["name"];
  `);

  emitter.appendCode(`
    export function getPriorities() {
      return [
        ${priorities.map(
          (x) => `{
          name: "${x.name}",
          color: "${x.color}",
          value: ${x.value},
          sort: ${x.sort}
        }`
        )}
      ] as const;
    }

    export type RuntimePriority = ReturnType<typeof getPriorities>[number];
    export type RuntimePriorityName = RuntimePriority["name"];
  `);

  emitter.appendCode(`
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
`);

  emitter.appendCode(`
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
  `);

  // Add a map of entity types and type for EntityType and a type for EntityData
  emitter.appendCode(`
    export interface EntityTypeMap {
      ${schemas
        .map((s) => s.id)
        .map((name) => `${name}: ${name};`)
        .join("\n")}
    }
    
    export type EntityType = keyof EntityTypeMap;
    export type EntityData<TEntityType extends EntityType = EntityType> = EntityTypeMap[TEntityType];
  `);

  /**
  BasicLink needs to be added explicitly, as it is not returned by the API.
  Task: 95e02be2-c7ec-11ed-ae64-46416ff77027
  */
  emitter.appendCode(`
    export interface BasicLink {
      id: string;
      type: string;
      name: string;
    }
  `);

  // Add a map of TypedContext subtypes and type for TypedContextSubtype
  emitTypedContextTypes(emitter, schemas);

  emitCustomAttributes(emitter, schemas, customAttributes);

  return {
    prettifiedContent: emitter.toString(),
    errors: emitter.errors,
  };
}

async function getCustomAttributes(session: Session) {
  const customAttributes = await session.query<CustomAttributeConfiguration>(
    "select default, label, key, project_id, entity_type, is_hierarchical, object_type.name, type.name from CustomAttributeConfiguration order by sort"
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
    "select is_billable, name, task_type_schemas from Type order by sort"
  );
  return types.data;
}

async function getPriorities(session: Session) {
  const priorities = await session.query<Priority>(
    "select id, color, name, sort, value from Priority order by sort"
  );
  return priorities.data;
}

async function getStatuses(session: Session) {
  const priorities = await session.query<Status>(
    "select id, color, is_active, name, sort, state from Status order by sort"
  );
  return priorities.data;
}

async function getObjectTypes(session: Session) {
  const objectTypes = await session.query<ObjectType>(
    "select id, is_leaf, is_prioritizable, is_schedulable, is_statusable, is_taskable, is_time_reportable, is_typeable, name, project_schemas from ObjectType order by sort"
  );
  return objectTypes.data;
}

async function getProjectSchemas(session: Session) {
  const projectSchemas = await session.query<ProjectSchema>(
    "select name, asset_version_workflow_schema, name, object_type_schemas, object_types, task_templates, task_type_schema, task_workflow_schema, task_workflow_schema_overrides from ProjectSchema"
  );
  return projectSchemas.data;
}

function emitTypedContextTypes(
  builder: TypeScriptEmitter,
  schemas: QuerySchemasResponse
) {
  builder.appendCode(`
    export interface TypedContextSubtypeMap {
      ${schemas
        .filter(
          (schema) =>
            (typeof schema?.alias_for === "object" &&
              schema.alias_for.id === "Task") ||
            schema.id === "TypedContext"
        )
        .map((s) => s.id)
        .map((name) => `${name}: ${name};`)
        .join("\n")}
    }
    export type TypedContextSubtype = keyof TypedContextSubtypeMap;
  `);
}
