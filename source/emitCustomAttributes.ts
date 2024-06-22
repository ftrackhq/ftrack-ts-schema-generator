export function emitCustomAttributes(customAttributes: CustomAttributeConfiguration[]) {
    return `
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
  
      ${customAttributes
        .map(x => `type ${getCustomAttributeTypeNameFromAttribute(x)} = Omit<ContextCustomAttributeValue, 'key' | 'value'> & {
            key: "${x.key}",
            value: ${getTypeScriptTypeFromCustomAttributeType(x.type.name)}
        }`)
        .join('\n')}
    `;
}

export function getCustomAttributeTypeNameFromAttribute(x: CustomAttributeConfiguration) {
  return `CustomAttributeValue_${x.key}`;
}

export function getTypeScriptTypeFromCustomAttributeType(customAttributeType: string) {
    switch (customAttributeType) {
        case 'dynamic enumerator':
            return 'string[]';

        case 'date':
            return 'string';

        case 'text':
            return 'string';

        case 'url':
            return 'string';

        case 'enumerator':
            return 'string[]';

        case 'expression':
            return 'string';
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
    }
};