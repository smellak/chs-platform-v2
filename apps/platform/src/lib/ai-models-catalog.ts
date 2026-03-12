/**
 * AI Models Catalog — Official pricing per provider (per million tokens).
 * Prices updated March 2026.
 */

export interface CatalogModel {
  id: string;
  name: string;
  /** Price per 1M input tokens (USD) */
  inputPricePer1M: number;
  /** Price per 1M output tokens (USD) */
  outputPricePer1M: number;
}

export interface ProviderCatalog {
  label: string;
  baseUrl: string;
  models: CatalogModel[];
}

export const AI_MODELS_CATALOG: Record<string, ProviderCatalog> = {
  google: {
    label: "Google AI",
    baseUrl: "https://generativelanguage.googleapis.com",
    models: [
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", inputPricePer1M: 0.10, outputPricePer1M: 0.40 },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", inputPricePer1M: 0.30, outputPricePer1M: 2.50 },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", inputPricePer1M: 1.25, outputPricePer1M: 10.00 },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)", inputPricePer1M: 0.50, outputPricePer1M: 3.00 },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", inputPricePer1M: 2.00, outputPricePer1M: 12.00 },
    ],
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    models: [
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", inputPricePer1M: 1.00, outputPricePer1M: 5.00 },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", inputPricePer1M: 3.00, outputPricePer1M: 15.00 },
      { id: "claude-opus-4", name: "Claude Opus 4", inputPricePer1M: 15.00, outputPricePer1M: 75.00 },
    ],
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", inputPricePer1M: 0.15, outputPricePer1M: 0.60 },
      { id: "gpt-4o", name: "GPT-4o", inputPricePer1M: 2.50, outputPricePer1M: 10.00 },
      { id: "gpt-5.2", name: "GPT-5.2", inputPricePer1M: 1.75, outputPricePer1M: 14.00 },
    ],
  },
  xai: {
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    models: [
      { id: "grok-3", name: "Grok 3", inputPricePer1M: 3.00, outputPricePer1M: 15.00 },
      { id: "grok-3-mini", name: "Grok 3 Mini", inputPricePer1M: 0.30, outputPricePer1M: 0.50 },
    ],
  },
};

/** Convert price per 1M tokens to price per 1K tokens */
export function pricePer1MTo1K(pricePer1M: number): number {
  return pricePer1M / 1000;
}

/** Format price display: "$0.30 / $2.50 por MTok" */
export function formatModelPrice(model: CatalogModel): string {
  return `$${model.inputPricePer1M.toFixed(2)} / $${model.outputPricePer1M.toFixed(2)} por MTok`;
}
