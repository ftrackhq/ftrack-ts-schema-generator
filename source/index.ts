#!/usr/bin/env node
// :copyright: Copyright (c) 2023 ftrack
import { emitToFile } from "./emit.ts";

const outputPath = process.argv[2] || "__generated__";
const outputFilename = process.argv[3] || "schema.ts";
const { errors, schemas } = await emitToFile(outputPath, outputFilename);

console.info(`${schemas.length} schema(s) found`);

if (errors.length > 0) {
  console.warn("One or more errors occured:");
  for (const error of errors) {
    console.warn(error);
  }
}
