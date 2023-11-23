import { beforeEach, expect, test, vi } from "vitest";
import {
  CustomAttributeConfiguration,
  ObjectType,
  ProjectSchema,
  Type,
  emitToString,
} from "./emit";
import { QuerySchemasResponse, Schema } from "@ftrack/api";
import { readFile } from "fs/promises";
import { join } from "path";

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
    []
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
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-subtype-of-TypedContext.snap")
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
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-base-schema.snap")
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
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-immutable-property.snap")
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
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-integer-type.snap")
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
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-variable-type.snap")
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
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "schema-has-array-type.snap")
  );
});

test("default ftrack schema", async () => {
  //arrange
  const contents = await readFile(
    join(".", "source", "__snapshots__", "responses", "query_schemas.json")
  );
  const schemas: Array<Schema> = JSON.parse(contents.toString());

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    schemas,
    [],
    [],
    [],
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "default-ftrack-schema.snap")
  );
});

test("default custom attributes", async () => {
  //arrange
  const contents = await readFile(
    join(
      ".",
      "source",
      "__snapshots__",
      "responses",
      "query_custom_attribute_configurations.json"
    )
  );
  const customAttributes: CustomAttributeConfiguration[] = JSON.parse(
    contents.toString()
  );

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    [getTypedContextSchema()],
    customAttributes,
    [],
    [],
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "default-custom-attributes.snap")
  );
});

test("default types", async () => {
  //arrange
  const contents = await readFile(
    join(".", "source", "__snapshots__", "responses", "query_types.json")
  );
  const types: Type[] = JSON.parse(contents.toString());

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    [getTypedContextSchema()],
    [],
    types,
    [],
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "default-types.snap")
  );
});

test("default object types", async () => {
  //arrange
  const contents = await readFile(
    join(".", "source", "__snapshots__", "responses", "query_object_types.json")
  );
  const objectTypes: ObjectType[] = JSON.parse(
    contents.toString()
  );

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    [getTypedContextSchema()],
    [],
    [],
    objectTypes,
    []
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "default-object-types.snap")
  );
});

test("default highway test (all values specified)", async () => {
  //arrange
  const schemasContents = await readFile(
    join(".", "source", "__snapshots__", "responses", "query_project_schema.json")
  );
  const schemas: Array<ProjectSchema> = JSON.parse(schemasContents.toString());

  const customAttributeContents = await readFile(
    join(
      ".",
      "source",
      "__snapshots__",
      "responses",
      "query_custom_attribute_configurations.json"
    )
  );
  const customAttributes: CustomAttributeConfiguration[] = JSON.parse(
    customAttributeContents.toString()
  );

  const typesContents = await readFile(
    join(".", "source", "__snapshots__", "responses", "query_types.json")
  );
  const types: Type[] = JSON.parse(typesContents.toString());

  const objectTypeContents = await readFile(
    join(".", "source", "__snapshots__", "responses", "query_object_types.json")
  );
  const objectTypes: ObjectType[] = JSON.parse(
    objectTypeContents.toString()
  );

  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    [getTypedContextSchema()],
    customAttributes,
    types,
    objectTypes,
    schemas
  );

  //assert
  expect(emitResult.errors).toEqual([]);
  expect(emitResult.prettifiedContent).toMatchFileSnapshot(
    join(".", "__snapshots__", "default-highway-test.snap")
  );
});

function getTypedContextSchema() {
  return {
    id: "TypedContext",
    properties: {},
  } as Partial<Schema> as Schema;
}
