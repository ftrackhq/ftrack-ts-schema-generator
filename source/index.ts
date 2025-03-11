#!/usr/bin/env node
// :copyright: Copyright (c) 2023 ftrack
// A node.js script to convert our query_schema to TypeScript types
// TODO: Change type to module in API
import { Session } from "@ftrack/api";
import { emitToFile } from "./emit";

const session = new Session(
  process.env.FTRACK_SERVER ?? "",
  process.env.FTRACK_API_USER ?? "",
  process.env.FTRACK_API_KEY ?? "",
);

const outputPath = process.argv[2] || "__generated__";
const outputFilename = process.argv[3] || "schema.ts";
const { errors, schemas } = await emitToFile(
  session,
  outputPath,
  outputFilename,
);

console.info(`${schemas.length} schema(s) found`);

if (errors.length > 0) {
  console.warn("One or more errors occured:");
  for (const error of errors) {
    console.warn(error);
  }
}
