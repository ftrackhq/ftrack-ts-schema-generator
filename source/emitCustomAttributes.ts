import type { QuerySchemasResponse } from "@ftrack/api";
import { TypeScriptEmitter } from "./typescriptEmitter.ts";
import type { Schema } from "./session.ts";

const uniq = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

const groupBy = <T, K extends string>(list: T[], getKey: (item: T) => K) => {
  return list.reduce(
    (acc, obj) => {
      const key = getKey(obj);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    },
    {} as Record<K, T[]>,
  );
};

export function emitCustomAttributes(
  typescriptEmitter: TypeScriptEmitter,
  schemas: QuerySchemasResponse<Schema>,
  customAttributes: CustomAttributeConfiguration[],
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
            }`,
            )}
        ] as const;
    }
      
    export type RuntimeCustomAttributeConfiguration = ReturnType<typeof getAttributeConfigurations>[number];
    export type RuntimeCustomAttributeConfigurationName = RuntimeCustomAttributeConfiguration["name"];
    export type RuntimeCustomAttributeConfigurationLabel = RuntimeCustomAttributeConfiguration["label"];

    type BaseCustomAttributeValue = Omit<ContextCustomAttributeValue, 'key' | 'value'>;

    export interface TypedCustomAttributeValueMap {
        ${Object.values(groupBy(customAttributes, (x) => x.key))
          .map(
            (x) =>
              `${x[0].key}: ${uniq(
                x.map((y) =>
                  getTypeScriptTypeFromCustomAttributeType(y.type.name),
                ),
              ).join("|")}`,
          )
          .join("\n")}
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
                uniq(
                  customAttributes
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
                    .map((x) => `TypedCustomAttributeValue<"${x.key}">`),
                ).join("|") || "never"
              }
            `,
        )
        .join(";")}
      };
  `);
}

export function getTypeScriptTypeFromCustomAttributeType(
  customAttributeType: string,
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
