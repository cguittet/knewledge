import { describe, expect, it } from "vitest";
import { embeddingModelUsage, jobUsageColumns, responseModelUsage } from "./usage.js";

describe("model usage", () => {
  it("records response token breakdowns and embedding tokens", () => {
    const response = responseModelUsage("gpt-5.6-luna", {
      input_tokens: 10_000,
      input_tokens_details: { cached_tokens: 2_000 },
      output_tokens: 1_000,
      output_tokens_details: { reasoning_tokens: 300 },
      total_tokens: 11_000,
    }, "resp_123");
    const embedding = embeddingModelUsage("text-embedding-3-small", { prompt_tokens: 4_000, total_tokens: 4_000 });
    const columns = jobUsageColumns([response, embedding]);

    expect(columns).toMatchObject({
      input_tokens: 10_000,
      cached_input_tokens: 2_000,
      output_tokens: 1_000,
      reasoning_tokens: 300,
      embedding_tokens: 4_000,
      total_tokens: 15_000,
    });
    expect(columns.estimated_cost_usd).toBeCloseTo(0.01428, 8);
  });

  it("leaves cost null when a configured model has no pricing snapshot", () => {
    const usage = embeddingModelUsage("custom-embedding-model", { prompt_tokens: 100, total_tokens: 100 });
    expect(jobUsageColumns([usage]).estimated_cost_usd).toBeNull();
  });

  it("uses the base model price for dated model snapshots", () => {
    const usage = responseModelUsage("gpt-5.6-luna-2026-07-01", {
      input_tokens: 1_000,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 0,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 1_000,
    });
    expect(jobUsageColumns([usage]).estimated_cost_usd).toBe(0.001);
  });
});
