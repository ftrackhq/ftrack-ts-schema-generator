import { expect, test, vi } from "vitest";
import { emitToString } from "./emit";
import { QuerySchemasResponse, Schema } from "@ftrack/api";

test("emitting with no schemas returns error", async () => {
  //act
  const emitResult = await emitToString(
    "4.13.8",
    "https://ftrack.example.com",
    []
  );

  //assert
  expect(emitResult?.errors[0]).toBe("No schemas found!");
});

test("schema subtype of TypedContext", async () => {
  //arrange
  vi.setSystemTime(new Date(2023, 1, 1));

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
    schemas as QuerySchemasResponse
  );

  //assert
  expect(emitResult.errors).toHaveLength(0);
  expect(emitResult.prettifiedContent).toMatchSnapshot();
});

test("schema has base schema", async () => {
  //arrange
  vi.setSystemTime(new Date(2023, 1, 1));

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
    schemas as QuerySchemasResponse
  );

  //assert
  expect(emitResult.errors).toHaveLength(0);
  expect(emitResult.prettifiedContent).toMatchSnapshot();
});

test("schema has immutable property", async () => {
  //arrange
  vi.setSystemTime(new Date(2023, 1, 1));

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
    schemas as QuerySchemasResponse
  );

  //assert
  expect(emitResult.errors).toHaveLength(0);
  expect(emitResult.prettifiedContent).toMatchSnapshot();
});

test("schema has integer type", async () => {
  //arrange
  vi.setSystemTime(new Date(2023, 1, 1));

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
    schemas as QuerySchemasResponse
  );

  //assert
  expect(emitResult.errors).toHaveLength(0);
  expect(emitResult.prettifiedContent).toMatchSnapshot();
});

test("schema has variable type", async () => {
  //arrange
  vi.setSystemTime(new Date(2023, 1, 1));

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
    schemas as QuerySchemasResponse
  );

  //assert
  expect(emitResult.errors).toHaveLength(0);
  expect(emitResult.prettifiedContent).toMatchSnapshot();
});

test("schema has array type", async () => {
  //arrange
  vi.setSystemTime(new Date(2023, 1, 1));

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
    schemas as QuerySchemasResponse
  );

  //assert
  expect(emitResult.errors).toHaveLength(0);
  expect(emitResult.prettifiedContent).toMatchSnapshot();
});

function getTypedContextSchema() {
  return {
    id: "TypedContext",
    properties: {},
  } as Partial<Schema> as Schema;
}
