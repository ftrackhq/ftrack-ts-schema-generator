import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    define: {
      'process.env.FTRACK_SERVER': JSON.stringify(process.env.FTRACK_SERVER),
      'process.env.FTRACK_API_USER': JSON.stringify(process.env.FTRACK_API_USER),
      'process.env.FTRACK_API_KEY': JSON.stringify(process.env.FTRACK_API_KEY)
    }
  
    lib: {
      entry: resolve(__dirname, "source/index.ts"),
      name: "ftrack-ts-schema-generator",
      fileName: (format) => `ftrack-ts-schema-generator.${format}.js`,
    },
    rollupOptions: {
      external: ["prettier"], // List any external dependencies that you don't want bundled
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
    sourcemap: true,
  },
});
