import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_grakcwdwsqqtgaqkpvgg",
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 600,
  dirs: ["./src/tasks"],
  build: {
    external: ["jsdom", "sharp"],
  },
});
