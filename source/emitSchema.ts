// :copyright: Copyright (c) 2023 ftrack
import type {
  QuerySchemasResponse,
  Schema,
  SchemaProperties,
  TypedSchemaProperty,
} from "@ftrack/api";
import { type TypeScriptEmitter } from "./typescriptEmitter";
import { isSchemaTypedContext } from "./utils";

// Add schemas from the schemas folder, to be used for finding extended schemas
export async function emitSchemaInterface(
  typescriptEmitter: TypeScriptEmitter,
  schema: Schema,
  allSchemas: QuerySchemasResponse,
) {
  const interfaceName = getTypeScriptInterfaceNameForInterface(schema);

  // If the schema is a subtype of TypedContext, return that
  if (typeof schema?.alias_for === "object" && schema.alias_for.id === "Task") {
    typescriptEmitter.appendCode(`
      export type ${interfaceName} = TypedContextForSubtype<"${interfaceName}">;
    `);
    return;
  }

  // Check if the schema extends another schema and get that base schema
  const baseSchema = getBaseSchema(schema, allSchemas);

  // Get the typedContext schema, to filter the properties for typedContext subtypes
  const typedContextSchema = allSchemas.find(isSchemaTypedContext);

  typescriptEmitter.appendCode(`
    export interface ${interfaceName}${getTypeExtensionSuffix(
      baseSchema,
      schema,
    )} {
  `);

  // For each property, add a type to the interface
  emitTypeProperties(
    typescriptEmitter,
    schema,
    baseSchema?.properties,
    typedContextSchema?.properties,
  );

  // Entity type and permissions are missing from the source schema, so add them to the interface
  emitSpecialProperties(typescriptEmitter, schema);

  typescriptEmitter.appendCode(`}`);
}

function getTypeScriptInterfaceNameForInterface(schema: Schema) {
  // Adds a generic to the interface to TypedContext, which is used for subtypes of TypedContext
  if (isSchemaTypedContext(schema)) {
    return "TypedContextForSubtype<K extends TypedContextSubtype>";
  }

  return schema.id;
}

function emitSpecialProperties(
  typescriptEmitter: TypeScriptEmitter,
  schema: Schema,
) {
  if (isSchemaTypedContext(schema)) {
    typescriptEmitter.appendCode(`__entity_type__?: K;`);
  } else {
    typescriptEmitter.appendCode(`__entity_type__?: "${schema.id}";`);
  }
  typescriptEmitter.appendCode(`__permissions?: Record<string, any>;`);

  if (schema.properties && "custom_attributes" in schema.properties) {
    if (isSchemaTypedContext(schema)) {
      typescriptEmitter.appendCode(
        `custom_attributes?: Array<TypedContextCustomAttributesMap[K]>;`,
      );
    } else {
      typescriptEmitter.appendCode(
        `custom_attributes?: Array<TypedContextCustomAttributesMap["${schema.id}"]>;`,
      );
    }
  }
}

function getTypeExtensionSuffix(
  baseSchema: Schema | undefined,
  schema: Schema,
) {
  const omitList = ["__entity_type__", "__permissions"];
  if (baseSchema?.properties && "custom_attributes" in baseSchema.properties) {
    omitList.push("custom_attributes");
  }

  const omitString = `"${omitList.join('" | "')}"`;

  const baseSchemaSuffix = baseSchema?.id
    ? ` extends Omit<${baseSchema.id}, ${omitString}>`
    : "";

  const typedContextSubtypeSuffix =
    typeof schema?.alias_for === "object" && schema.alias_for.id === "Task"
      ? ` extends Omit<TypedContext, ${omitString}>`
      : "";

  //Both should never be true, but ¯\_(ツ)_/¯
  return baseSchemaSuffix + typedContextSubtypeSuffix;
}

//Todo: update when Schema type in API is updated
function getBaseSchema(schema: Schema, allSchemas: QuerySchemasResponse) {
  const baseSchema = allSchemas.find((s) => {
    if (!schema.$mixin) {
      return false;
    }

    return s.id === schema.$mixin["$ref"];
  });
  return baseSchema;
}
function emitTypeProperties(
  typescriptEmitter: TypeScriptEmitter,
  schema: Schema,
  baseSchemaProperties?: SchemaProperties,
  typedContextProperties?: SchemaProperties,
) {
  // Filter out deprecated properties, that start with _
  const deprecationFilteredProperties = Object.entries(
    schema.properties || [],
  ).filter(([key]) => !key.startsWith("_"));
  // Filter out all properties that are defined in the base schema
  const baseSchemaFilteredProperties = deprecationFilteredProperties.filter(
    ([key]) => !baseSchemaProperties?.[key],
  );

  let filteredProperties = baseSchemaFilteredProperties;
  if (typeof schema?.alias_for === "object" && schema.alias_for.id === "Task") {
    filteredProperties = deprecationFilteredProperties.filter(
      ([key]) => !typedContextProperties?.[key],
    );
  }
  // Sort the object by key
  filteredProperties.sort((a, b) => (a[0] > b[0] ? 1 : -1));

  filteredProperties.forEach(([key, value]) => {
    if (typeof value !== "object" || value === null) {
      throw new Error(
        `Property ${key} in schema ${schema.id} is not an object`,
      );
    }

    // If neither type or $ref is defined, we can't generate a type. Log an error
    if (!("type" in value) && !("$ref" in value)) {
      typescriptEmitter.appendError(
        `No type or $ref defined for property ${key} in schema ${schema.id}`,
      );
    }

    const isRequired =
      schema.required?.includes(key) || schema.primary_key?.includes(key);

    let type;
    if ("$ref" in value && value.$ref) {
      type = value.$ref;
    }
    if ("type" in value && value.type) {
      verifyValidType(value.type);
      type = convertTypeToTsType(key, value);
    }
    let prefix = "";
    // If the property is immutable, add a readonly prefix
    if (schema.immutable?.includes(key) || schema.computed?.includes(key)) {
      prefix = `readonly `;
    }

    /**
    Hack to get around the fact that the API doesn't return the correct type for BasicLink
    Task: 95e02be2-c7ec-11ed-ae64-46416ff77027
    */
    if (key === "link" && type === "string") {
      type = "BasicLink[]";
    }

    if (key === "custom_attributes") {
      return;
    }

    // All properties are optional, adds a question mark
    typescriptEmitter.appendCode(
      `${prefix}${key}${!isRequired ? "?" : ""}: ${type};`,
    );
  });
}

function convertTypeToTsType(key: string, value: TypedSchemaProperty): string {
  // Fix some types that are not supported by TypeScript
  if (value.type === "integer") {
    return "number";
  }

  if (value.type === "variable") {
    return "string | number | boolean | string[]"; // Or maybe string?
  }

  // If the type is an array, we need to check if the items are a built in type or a reference
  if (value.type === "array" || value.type === "mapped_array") {
    if (!value.items) {
      throw new Error(`No items defined for array ${key}`);
    }

    if (value.items.$ref) {
      return `${value.items.$ref}[]`;
    }
  }

  return value.type;
}
function verifyValidType(type: string) {
  if (
    ![
      "object",
      "array",
      "string",
      "number",
      "boolean",
      "mapped_array",
      "integer",
      "variable",
    ].includes(type)
  ) {
    throw new Error(`Invalid type ${type}`);
  }
}
