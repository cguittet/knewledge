import { describe, expect, it } from "vitest";
import { contentHash, normalizeTopic } from "./utils.js";

describe("processing persistence", () => {
  it("uses stable hashes despite whitespace", () => expect(contentHash("hello  world\n")).toBe(contentHash("hello world")));
  it("normalizes topic labels", () => expect(normalizeTopic("  AI & Sales  ")).toBe("ai-sales"));
});
