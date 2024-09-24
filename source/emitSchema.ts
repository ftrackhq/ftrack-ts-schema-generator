// :copyright: Copyright (c) 2023 ftrack
import type {
  QuerySchemasResponse,
  RefSchemaProperty,
  Schema,
  SchemaProperties,
  TypedSchemaProperty,
} from "@ftrack/api";
import { type TypeScriptEmitter } from "./typescriptEmitter";
import { isSchemaTypedContext } from "./utils";
import { chain } from "lodash-es";

// Add schemas from the schemas folder, to be used for finding extended schemas
export async function emitSchemaInterface(
  typescriptEmitter: TypeScriptEmitter,
  schema: Schema,
  allSchemas: QuerySchemasResponse
) {
  const isSchemaSubtypeOfTypedContext = typeof schema?.alias_for === "object" && schema.alias_for.id === "Task";
  if (isSchemaSubtypeOfTypedContext) {
    typescriptEmitter.appendBlock(`
      export type ${schema.id} = TypedContextForSubtype<"${schema.id}">;
    `);
    return;
  }

  // Check if the schema extends another schema and get that base schema
  const baseSchema = getBaseSchema(schema, allSchemas);

  // Get the typedContext schema, to filter the properties for typedContext subtypes
  const typedContextSchema = allSchemas.find(isSchemaTypedContext);

  const interfaceName = isSchemaTypedContext(schema) ?
    `TypedContextForSubtype<K extends TypedContextSubtype>` :
    `${schema.id}`;
  typescriptEmitter.appendBlock(`export interface ${interfaceName}`);
    
  typescriptEmitter.appendInline(getTypeExtensionSuffix(
    baseSchema,
    schema
  ));

  typescriptEmitter.appendBlock(`{`);

  // For each property, add a type to the interface
  emitTypeProperties(
    typescriptEmitter,
    schema,
    baseSchema?.properties,
    typedContextSchema?.properties
  );

  // Entity type and permissions are missing from the source schema, so add them to the interface
  emitSpecialProperties(typescriptEmitter, schema);

  typescriptEmitter.appendBlock(`}`);
}

function emitSpecialProperties(
  typescriptEmitter: TypeScriptEmitter,
  schema: Schema
) {
  if (isSchemaTypedContext(schema)) {
    typescriptEmitter.appendBlock(`__entity_type__?: K;`);
  } else {
    typescriptEmitter.appendBlock(`__entity_type__?: "${schema.id}";`);
  }
  typescriptEmitter.appendBlock(`__permissions?: Record<string, any>;`);
}

function getTypeExtensionSuffix(
  baseSchema: Schema | undefined,
  schema: Schema
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
  typedContextProperties?: SchemaProperties
) {
  const properties = chain(Object.entries(schema.properties || []))
    .filter(([propertyName]) => !isPropertyNameDeprecated(propertyName))
    .filter(([propertyName]) => typeof schema?.alias_for === "object" && schema.alias_for.id === "Task" ?
      !doesPropertyExistInSchema(typedContextProperties, propertyName) :
      !doesPropertyExistInSchema(baseSchemaProperties, propertyName))
    .orderBy(([propertyName]) => propertyName, 'asc')
    .value();

  for(const [propertyName, value] of properties) {
    const type = getTypeOfSchemaProperty(schema, propertyName, value);
    if (!type) {
      typescriptEmitter.appendError(
        `No type or $ref defined for property ${propertyName} in schema ${schema.id}`
      );
      continue;
    }

    const isImmutable = schema.immutable?.includes(propertyName) || schema.computed?.includes(propertyName);
    if (isImmutable) {
      typescriptEmitter.appendBlock("readonly");
    }

    typescriptEmitter.appendInline(propertyName);

    const isRequired =
      schema.required?.includes(propertyName) || schema.primary_key?.includes(propertyName);
    if (!isRequired) {
      typescriptEmitter.appendInline("?");
    }

    typescriptEmitter.appendInline(`: ${type}; `);
  }
}

function getTypeOfSchemaProperty(schema: Schema, propertyName: string, value: TypedSchemaProperty | RefSchemaProperty) {
  if(propertyName === "custom_attributes") {
    if (isSchemaTypedContext(schema)) {
      return "Array<TypedContextCustomAttributesMap[K]>";
    } else {
      return `Array<TypedContextCustomAttributesMap["${schema.id}"]>`;
    }
  }

  let type;
  if ("$ref" in value && value.$ref) {
    type = value.$ref;
  } else if ("type" in value && value.type) {
    type = convertTypeToTsType(propertyName, value);
  }

  /**
  Hack to get around the fact that the API doesn't return the correct type for BasicLink
  Task: 95e02be2-c7ec-11ed-ae64-46416ff77027
  */
  if (propertyName === "link" && type === "string") {
    return "BasicLink[]";
  }

  return type;
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

function doesPropertyExistInSchema(typedContextProperties: SchemaProperties | undefined, propertyName: string) {
  return typedContextProperties?.[propertyName];
}

function isPropertyNameDeprecated(propertyName: string) {
  return propertyName.startsWith("_");
}