import { describe, expect, it } from "vitest";
import { blockedPageMessage } from "./fetch-page.js";
import { contentHash, normalizeTopic } from "./utils.js";

describe("processing persistence", () => {
  it("uses stable hashes despite whitespace", () => expect(contentHash("hello  world\n")).toBe(contentHash("hello world")));
  it("normalizes topic labels", () => expect(normalizeTopic("  AI & Sales  ")).toBe("ai-sales"));
});

describe("page failure details", () => {
  it("identifies a Cloudflare browser challenge without attempting to bypass it", () => {
    const message = blockedPageMessage({ status: 403, headers: new Headers({ "cf-mitigated": "challenge" }) });
    expect(message).toContain("Cloudflare browser challenge");
    expect(message).toContain("Copy the page text");
  });

  it("suggests retrying when a site rate-limits retrieval", () => {
    expect(blockedPageMessage({ status: 429, headers: new Headers() })).toContain("Try again later");
  });
});
