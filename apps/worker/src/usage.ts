export type ModelUsage = {
  model: string;
  requestType: "response" | "embedding";
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  requestId?: string;
};

type ResponseUsage = {
  input_tokens: number;
  input_tokens_details?: {
    cached_tokens?: number;
    cache_write_tokens?: number;
    cache_write_input_tokens?: number;
  };
  output_tokens: number;
  output_tokens_details?: { reasoning_tokens?: number };
  total_tokens: number;
};

type EmbeddingUsage = { prompt_tokens: number; total_tokens: number };

export const PRICING_SNAPSHOT = "2026-07-24-standard";

const PRICES_PER_MILLION: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.6-luna": { input: 1, cachedInput: 0.1, output: 6 },
  "gpt-5.6-terra": { input: 2.5, cachedInput: 0.25, output: 15 },
  "text-embedding-3-small": { input: 0.02, cachedInput: 0.02, output: 0 },
};

function priceForModel(model: string) {
  return PRICES_PER_MILLION[model] ?? Object.entries(PRICES_PER_MILLION).find(([baseModel]) => model.startsWith(`${baseModel}-`))?.[1];
}

export function responseModelUsage(model: string, usage: ResponseUsage | null | undefined, requestId?: string): ModelUsage {
  const details = usage?.input_tokens_details;
  return {
    model,
    requestType: "response",
    inputTokens: usage?.input_tokens ?? 0,
    cachedInputTokens: details?.cached_tokens ?? 0,
    cacheWriteInputTokens: details?.cache_write_input_tokens ?? details?.cache_write_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    ...(requestId ? { requestId } : {}),
  };
}

export function embeddingModelUsage(model: string, usage: EmbeddingUsage | null | undefined): ModelUsage {
  return {
    model,
    requestType: "embedding",
    inputTokens: usage?.prompt_tokens ?? 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

export function jobUsageColumns(calls: ModelUsage[]) {
  const responseCalls = calls.filter((call) => call.requestType === "response");
  const embeddingCalls = calls.filter((call) => call.requestType === "embedding");
  const sum = (items: ModelUsage[], field: keyof Pick<ModelUsage, "inputTokens" | "cachedInputTokens" | "cacheWriteInputTokens" | "outputTokens" | "reasoningTokens" | "totalTokens">) =>
    items.reduce((total, item) => total + item[field], 0);
  const unknownModels = [...new Set(calls.filter((call) => !priceForModel(call.model)).map((call) => call.model))];
  const estimatedCostUsd = unknownModels.length ? null : calls.reduce((total, call) => {
    const price = priceForModel(call.model)!;
    const uncachedInput = Math.max(0, call.inputTokens - call.cachedInputTokens);
    return total + ((uncachedInput * price.input) + (call.cachedInputTokens * price.cachedInput) + (call.outputTokens * price.output)) / 1_000_000;
  }, 0);

  return {
    input_tokens: sum(responseCalls, "inputTokens"),
    cached_input_tokens: sum(responseCalls, "cachedInputTokens"),
    cache_write_input_tokens: sum(responseCalls, "cacheWriteInputTokens"),
    output_tokens: sum(responseCalls, "outputTokens"),
    reasoning_tokens: sum(responseCalls, "reasoningTokens"),
    embedding_tokens: sum(embeddingCalls, "inputTokens"),
    total_tokens: sum(calls, "totalTokens"),
    estimated_cost_usd: estimatedCostUsd,
    usage_details: {
      pricingSnapshot: PRICING_SNAPSHOT,
      unknownModels,
      calls,
    },
  };
}
