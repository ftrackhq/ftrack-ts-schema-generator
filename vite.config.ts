import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "source/index.ts"),
      name: "ftrack-ts-schema-generator",
      fileName: (format) => `ftrack-ts-schema-generator.${format}.js`,
    },
    rollupOptions: {
      external: ["@ftrack/api"], // List any external dependencies that you don't want bundled
    },
    sourcemap: true,
  },
});
