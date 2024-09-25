import { QuerySchemasResponse } from "@ftrack/api";
import { chain } from "lodash-es";
import { TypeScriptEmitter } from "./typescriptEmitter";

export function emitCustomAttributes(
  typescriptEmitter: TypeScriptEmitter,
  schemas: QuerySchemasResponse,
  customAttributes: CustomAttributeConfiguration[]
) {
  typescriptEmitter.appendCode(`
    export function getAttributeConfigurations() {
        return [
            ${customAttributes.map(
              (x) => `{
                name: "${x.key}",
                type: ${JSON.stringify(x.type?.name)},
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

    type BaseCustomAttributeValue = Omit<ContextCustomAttributeValue, 'key' | 'value'>;

    export interface TypedCustomAttributeValueMap {
        ${chain(customAttributes)
          .groupBy((x) => x.key)
          .map(
            (x) =>
              `${x[0].key}: ${chain(x)
                .map((y) =>
                  getTypeScriptTypeFromCustomAttributeType(y.type.name)
                )
                .uniq()
                .join("|")}`
          )
          .join("\n")
          .value()}
    }

    export type TypedCustomAttributeValue<K extends keyof TypedCustomAttributeValueMap> = BaseCustomAttributeValue & {
        key: K;
        value: TypedCustomAttributeValueMap[K];
    };

    export type TypedContextCustomAttributesMap = {
      ${schemas
        .map(
          (schema) => `
              ${schema.id}: ${
            chain(customAttributes)
              .filter((x) => {
                const alias =
                  typeof schema.alias_for === "string"
                    ? schema.alias_for
                    : schema.alias_for?.id;
                return (
                  x.is_hierarchical ||
                  x.object_type?.name === schema.id ||
                  (x.entity_type === "show" &&
                    alias?.toLowerCase() === x.entity_type)
                );
              })
              .map((x) => `TypedCustomAttributeValue<"${x.key}">`)
              .uniq()
              .join("|")
              .value() || "never"
          }
            `
        )
        .join(";")}
      };
  `);
}

export function getTypeScriptTypeFromCustomAttributeType(
  customAttributeType: string
) {
  switch (customAttributeType) {
    case "dynamic enumerator":
      return "string[]";

    case "date":
      return "string";

    case "text":
      return "string";

    case "url":
      return "string";

    case "enumerator":
      return "string[]";

    case "expression":
      return "string";
  }

  return customAttributeType;
}

export type CustomAttributeConfiguration = {
  __entity_type__: "CustomAttributeConfiguration";
  id: string;
  object_type: {
    __entity_type__: "ObjectType";
    id: string;
    name: string;
  };
  default: boolean | string[] | string | number;
  key: string;
  entity_type: string;
  label: string;
  project_id: string | null;
  is_hierarchical: boolean;
  values: [];
  type: {
    __entity_type__: "CustomAttributeType";
    id: string;
    name: string;
  };
};
