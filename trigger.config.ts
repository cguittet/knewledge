import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_grakcwdwsqqtgaqkpvgg",
  runtime: "node-22",
  logLevel: "log",
  maxDuration: 600,
  dirs: ["./apps/worker/src/tasks"],
  build: {
    conditions: ["@knewledge/source"],
    external: ["jsdom", "sharp"],
  },
});
