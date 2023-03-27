# ts-interface-generator

Gets the schema from a ftrack instance and generates typescript interfaces for all the entity types in the instance.

## Environment Variables

This script requires the following environment variables to be set:

- `FTRACK_SERVER`: The URL of your ftrack server instance.
- `FTRACK_API_USER`: The API user for your ftrack server instance.
- `FTRACK_API_KEY`: The API key for your ftrack server instance.

Please ensure these environment variables are set before running the script.

## Usage

### Running the script using Yarn

To run the script using Yarn, use the `yarn generate` command.

#### Using the default output path and filename

To use the default output path and filename, simply run:

```
yarn generate
```

#### Customizing the output path and filename

To customize the output path and filename, pass them as arguments after `--`:

```
yarn generate -- ./path/to/output/directory customSchemaFilename.ts
```

#### Choosing whether the output path is relative or absolute

By default, the output path is considered relative to the current working directory. To use an absolute path, pass an additional argument `false`:

```
yarn generate -- /absolute/path/to/output/directory customSchemaFilename.ts false
```

### Importing and using the `main` function in another TypeScript file

To import and use the `main` function in another TypeScript file, follow these steps:

1. Import the `main` function from the original TypeScript file:

```typescript
import { main } from "./your-typescript-file";
```

2. Call the `main` function with the desired output path, filename, and an optional `relative` parameter:

```typescript
async function runMainFunction() {
  const outputPath = "./relative/output/directory";
  const outputFilename = "customSchemaFilename.ts";
  const relative = true; // Change this to false if you want to use an absolute path
  await main(outputPath, outputFilename, relative);
}

runMainFunction();
```

In this example, the `outputPath` is considered relative to the current working directory because the `relative` parameter is set to `true`. If you set it to `false`, the provided `outputPath` will be used as-is.

## Output

The generated TypeScript file will contain interfaces for each entity type from the ftrack schema. Each interface represents the properties of that entity type, with the property names and types based on the schema.

In addition to the interfaces, the output file will also include:

- `EntityTypeMap`: A map of entity types to their corresponding TypeScript interfaces.
- `EntityType`: A type representing the valid entity type names.
- `EntityData`: A generic type that takes an EntityType and returns the corresponding interface from EntityTypeMap.
- `TypedContextSubtypeMap`: A map of TypedContext subtypes to their corresponding TypeScript interfaces.
- `TypedContextSubtype`: A type representing the valid TypedContext subtypes.

## Error Handling

If there are any issues during the generation of the TypeScript interfaces, errors will be logged as comments at the end of the output file.

## Contributing

If you find any issues or have suggestions for improvements, please feel free to open a pull request or create an issue in the project repository.

## License

This project is licensed under the Apache 2.0 - see the LICENSE file for details.
