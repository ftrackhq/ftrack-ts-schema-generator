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
import { chain, uniqBy } from "lodash-es";

// Add schemas from the schemas folder, to be used for finding extended schemas
export async function emitSchemaInterface(
  typescriptEmitter: TypeScriptEmitter,
  schema: Schema,
  allSchemas: QuerySchemasResponse
) {
  if (isSchemaSubtypeOfTypedContext(schema)) {
    typescriptEmitter.appendBlock(`
      export type ${schema.id} = TypedContextForSubtype<"${schema.id}">;
    `);
    return;
  }

  const baseSchema = isSchemaSubtypeOfTypedContext(schema) ?
    allSchemas.find(isSchemaTypedContext) :
    getBaseSchema(schema, allSchemas);

  const overriddenSchemaType = getOverriddenSchemaType(schema, baseSchema);
  typescriptEmitter.appendBlock(`export interface ${overriddenSchemaType.name ?? schema.id}`);

  typescriptEmitter.appendBlock(overriddenSchemaType.genericArguments ? 
    `<${overriddenSchemaType.genericArguments.join(", ")}>` : 
    "");
    
  typescriptEmitter.appendBlock(overriddenSchemaType.extends ? `extends ${overriddenSchemaType.extends}` : "");

  typescriptEmitter.appendBlock(`{`);

  emitTypeProperties(
    typescriptEmitter,
    schema,
    baseSchema
  );

  typescriptEmitter.appendBlock(`}`);
}

function isSchemaSubtypeOfTypedContext(schema: Schema) {
  return typeof schema?.alias_for === "object" && schema.alias_for.id === "Task";
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
  baseSchema?: Schema,
) {
  const allProperties = getAllNormalizedSchemaProperties(schema, baseSchema);

  for(const property of allProperties) {
    const isImmutable = schema.immutable?.includes(property.name) || schema.computed?.includes(property.name);
    if (isImmutable) {
      typescriptEmitter.appendBlock("readonly");
    }

    typescriptEmitter.appendInline(property.name);

    const isRequired =
      schema.required?.includes(property.name) || schema.primary_key?.includes(property.name);
    if (!isRequired) {
      typescriptEmitter.appendInline("?");
    }
    
    typescriptEmitter.appendInline(`: ${property.typescriptType}; `);
  }
}

//TODO: maybe NormalizedSchemaProperty could already contain this standardized property format in it, so that this function wouldn't have to be called
function getTypeOfNormalizedSchemaProperty(property: TypedSchemaProperty | RefSchemaProperty) {
  let type;
  if ("$ref" in property && property.$ref) {
    type = property.$ref;
  } else if ("type" in property && property.type) {
    type = convertNormalizedSchemaPropertyToTypeScriptType(property);
  }

  return type;
}

function getOverriddenSchemaType(schema?: Schema, baseSchema?: Schema|undefined): OverriddenType {
  if(!schema) {
    return {};
  }

  const globalPropertiesForBaseSchema = getGlobalPropertiesForSchema(baseSchema);

  const overriddenPropertiesFromBaseSchema = (getOverriddenSchemaType(baseSchema).properties || [])
    .filter(property => 
      doesPropertyExistInSchema(schema.properties, property.name));

  const propertiesToOmit = [
    ...globalPropertiesForBaseSchema,
    ...overriddenPropertiesFromBaseSchema
  ];
  
  const entityTypeMapKeyName = isSchemaTypedContext(schema) ? "K" : `"${schema.id}"`;
  if(isSchemaTypedContext(schema)) {
    return {
      name: "TypedContextForSubtype",
      genericArguments: ["K extends TypedContextSubtype"],
      extends: propertiesToOmit.length > 0 ? 
        `Omit<Context, "${propertiesToOmit.map(x => x.name).join('" | "')}">` :
        undefined,
      properties: [
        { name: "custom_attributes", typescriptType: `Array<TypedContextCustomAttributesMap[${entityTypeMapKeyName}]>` },
        { name: "type", typescriptType: `TypeFor<${entityTypeMapKeyName}>` },
        { name: "object_type", typescriptType: `ObjectTypeFor<${entityTypeMapKeyName}>` },
      ]
    };
  }

  return {
    name: schema?.id,
    extends: propertiesToOmit.length > 0 ? 
      `Omit<${baseSchema?.id}, "${propertiesToOmit.map(x => x.name).join('" | "')}">` : 
      undefined,
    properties: [
      { name: "custom_attributes", typescriptType: `Array<TypedContextCustomAttributesMap[${entityTypeMapKeyName}]>` },
      { name: "type", typescriptType: `TypeFor<${entityTypeMapKeyName}>` },
    ]
  };
}

function convertNormalizedSchemaPropertyToTypeScriptType(property: TypedSchemaProperty | RefSchemaProperty): string {
  if('$ref' in property) {
    return property.$ref;
  }

  // Fix some types that are not supported by TypeScript
  if (property.type === "integer") {
    return "number";
  }

  if (property.type === "variable") {
    return "string | number | boolean | string[]"; // Or maybe string?
  }

  // If the type is an array, we need to check if the items are a built in type or a reference
  if (property.type === "array" || property.type === "mapped_array") {
    if (!property.items) {
      throw new Error(`No items defined for array ${property.alias_for}`);
    }

    if (property.items.$ref) {
      return `${property.items.$ref}[]`;
    }
  }

  return property.type;
}

function doesPropertyExistInSchema(typedContextProperties: SchemaProperties | undefined, propertyName: string) {
  return typedContextProperties?.[propertyName];
}

function isPropertyNameDeprecated(propertyName: string) {
  return propertyName.startsWith("_") && !propertyName.startsWith("__");
}

function getAllNormalizedSchemaProperties(schema: Schema, baseSchema?: Schema): NormalizedSchemaProperty[] {
  const baseSchemaProperties = baseSchema ? getAllNormalizedSchemaProperties(baseSchema) : [];
  
  const schemaProperties = Object
    .entries(schema.properties || [])
    .map(([propertyName, property]) => ({
      name: propertyName,
      typescriptType: convertNormalizedSchemaPropertyToTypeScriptType(property)
    } as NormalizedSchemaProperty));

  const propertiesIncludingFromBase = [...baseSchemaProperties, ...schemaProperties];

  const overridenProperties = (getOverriddenSchemaType(schema).properties || [])
    .filter(property => propertiesIncludingFromBase
      .some(overriddenProperty => overriddenProperty.name === property.name));

  const globalProperties = getGlobalPropertiesForSchema(schema);

  return chain([
    ...globalProperties,
    ...overridenProperties,
    ...schemaProperties,
  ])
    .filter(property => !isPropertyNameDeprecated(property.name))
    .filter(property => !doesPropertyExistInSchema(baseSchema?.properties, property.name))
    .orderBy(property => property.name)
    .uniqBy(x => x.name)
    .value();
}

type OverriddenType = {
  genericArguments?: string[],
  name?: string,
  properties?: NormalizedSchemaProperty[],
  extends?: string
}

type NormalizedSchemaProperty = {
  name: string,
  typescriptType: string
}

function getGlobalPropertiesForSchema(schema: Schema | undefined) {
  if(!schema) {
    return [];
  }

  const entityTypeMapKeyName = isSchemaTypedContext(schema) ? "K" : `"${schema.id}"`;
  const globalProperties: NormalizedSchemaProperty[] = [
    { name: "__entity_type__", typescriptType: entityTypeMapKeyName },
    { name: "__permissions", typescriptType: "Record<string, any>" },
  ];
  return globalProperties;
}
