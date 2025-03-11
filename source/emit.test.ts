import { beforeEach, expect, test, vi } from "vitest";
import {
  ObjectType,
  Priority,
  ProjectSchema,
  Status,
  Type,
  emitToString,
} from "./emit";
import { QuerySchemasResponse, Schema } from "@ftrack/api";
import { readFile } from "fs/promises";
import { join } from "path";
import { CustomAttributeConfiguration } from "./emitCustomAttributes";

beforeEach(() => {
  vi.setSystemTime(new Date(2023, 1, 1, 0, 0, 0));
});

test("emitting with no schemas returns error", async () => {
  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult?.errors[0]).toBe("No schemas found!");
});

test("schema subtype of TypedContext", async () => {
  //arrange
  const schemas: Array<Partial<Schema>> = [
    getTypedContextSchema(),
    {
      id: "SomeInterfaceName",
      alias_for: {
        id: "Task",
      },
    },
  ];

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas as QuerySchemasResponse,
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-subtype-of-TypedContext.snap"),
  );
});

test("schema has base schema", async () => {
  //arrange
  const schemas: Array<Partial<Schema>> = [
    getTypedContextSchema(),
    {
      id: "SomeInterfaceName",
      $mixin: { $ref: "SomeBaseSchema" },
    },
    {
      id: "SomeBaseSchema",
      type: "variable",
    },
  ];

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas as QuerySchemasResponse,
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-base-schema.snap"),
  );
});

test("schema has immutable property", async () => {
  //arrange
  const schemas: Array<Partial<Schema>> = [
    getTypedContextSchema(),
    {
      id: "SomeInterfaceName",
      properties: {
        immutableProperty: {
          type: "variable",
        },
      },
      immutable: ["immutableProperty"],
    },
  ];

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas as QuerySchemasResponse,
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-immutable-property.snap"),
  );
});

test("schema has integer type", async () => {
  //arrange
  const schemas: Array<Partial<Schema>> = [
    getTypedContextSchema(),
    {
      id: "SomeInterfaceName",
      properties: {
        integerProperty: {
          type: "integer",
        },
      },
    },
  ];

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas as QuerySchemasResponse,
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-integer-type.snap"),
  );
});

test("schema has variable type", async () => {
  //arrange
  const schemas: Array<Partial<Schema>> = [
    getTypedContextSchema(),
    {
      id: "SomeInterfaceName",
      properties: {
        integerProperty: {
          type: "variable",
        },
      },
    },
  ];

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas as QuerySchemasResponse,
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-variable-type.snap"),
  );
});

test("schema has array type", async () => {
  //arrange
  const schemas: Array<Partial<Schema>> = [
    getTypedContextSchema(),
    {
      id: "SomeInterfaceName",
      properties: {
        arrayProperty: {
          type: "array",
          items: {
            $ref: "ArrayItem",
          },
        },
        mappedArrayProperty: {
          type: "mapped_array",
          items: {
            $ref: "ArrayItem",
          },
        },
      },
    },
    {
      id: "ArrayItem",
      type: "variable",
    },
  ];

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas as QuerySchemasResponse,
    [],
    [],
    [],
    [],
    [],
    [],
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-array-type.snap"),
  );
});

test("default highway test (all values specified)", async () => {
  //arrange
  const projectSchemas = await parseJsonFromFile<ProjectSchema[]>(
    join(
      ".",
      "source",
      "__snapshots__",
      "responses",
      "query_project_schema.json",
    ),
  );

  const schemas = await parseJsonFromFile<Schema[]>(
    join(".", "source", "__snapshots__", "responses", "query_schemas.json"),
  );

  const customAttributes = await parseJsonFromFile<
    CustomAttributeConfiguration[]
  >(
    join(
      ".",
      "source",
      "__snapshots__",
      "responses",
      "query_custom_attribute_configurations.json",
    ),
  );

  const types = await parseJsonFromFile<Type[]>(
    join(".", "source", "__snapshots__", "responses", "query_types.json"),
  );

  const objectTypes = await parseJsonFromFile<ObjectType[]>(
    join(
      ".",
      "source",
      "__snapshots__",
      "responses",
      "query_object_types.json",
    ),
  );

  const statuses = await parseJsonFromFile<Status[]>(
    join(".", "source", "__snapshots__", "responses", "query_statuses.json"),
  );

  const priorities = await parseJsonFromFile<Priority[]>(
    join(".", "source", "__snapshots__", "responses", "query_priorities.json"),
  );

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas,
    customAttributes,
    types,
    objectTypes,
    projectSchemas,
    statuses,
    priorities,
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "default-highway-test.snap"),
  );
});

async function parseJsonFromFile<T>(path: string): Promise<T> {
  const contents = await readFile(path);
  return JSON.parse(contents.toString());
}

function getTypedContextSchema() {
  return {
    id: "TypedContext",
    properties: {},
  } as Partial<Schema> as Schema;
}
