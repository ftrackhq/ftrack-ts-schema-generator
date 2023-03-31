# @ftrack/ts-schema-generator

A TypeScript schema generator for the ftrack platform. This package generates TypeScript types based on your ftrack standard and custom entities, allowing for type-safe interactions with the ftrack API.

## Environment Variables

This script requires the following environment variables to be set:

- `FTRACK_SERVER`: The URL of your ftrack server instance.
- `FTRACK_API_USER`: The API user for your ftrack server instance.
- `FTRACK_API_KEY`: The API key for your ftrack server instance.

Please ensure these environment variables are set before running the script.

## Usage

### Directly in the downloaded repository

After cloning or downloading the package, navigate to the package directory and run the following command:

```
yarn install
```

Then, to run the script using Yarn, use the `yarn generate` command.

### As a dependency in another project

Install the package as a dependency in your project:

```
yarn add --dev @ftrack/ts-schema-generator
```

Add the following script to your project's `package.json` file:

```json
"scripts": {
  "generate-ts-schema": "yarn run @ftrack/ts-schema-generator generate"
}
```

Then, run the script using the following command:

```
yarn generate-ts-schema
```

### Customizing the output path and filename

To customize the output path and filename, pass them as arguments after `--`:

```
yarn generate -- ./path/to/output/directory customSchemaFilename.ts
```

or if using the script as a dependency in another project:

```
yarn generate-ts-schema -- ./path/to/output/directory customSchemaFilename.ts
```

## Output

The generated TypeScript file will contain interfaces for each entity type from the ftrack schema. Each interface represents the properties of that entity type, with the property names and types based on the schema.

In addition to the interfaces, the output file will also include:

- `EntityTypeMap`: A map of entity types to their corresponding TypeScript interfaces.
- `EntityType`: A type representing the valid entity type names.
- `EntityData`: A generic type that takes an EntityType and returns the corresponding interface from EntityTypeMap.
- `TypedContextSubtypeMap`: A map of TypedContext subtypes to their corresponding TypeScript interfaces.
- `TypedContextSubtype`: A type representing the valid TypedContext subtypes.
