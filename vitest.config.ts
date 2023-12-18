// :copyright: Copyright (c) 2023 ftrack

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "TS Schema Generator",
    globals: true,
    globalSetup: __dirname + "/vitest.global-setup.ts",
  },
});
