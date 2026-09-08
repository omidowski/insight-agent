/** Preistabelle in Mikro-USD je 1M Token (Spec 37, FR-37-06). */
export interface ModelPrice { inputPerMillion: number; outputPerMillion: number }

const PRICES: Record<string, ModelPrice> = {
  'gpt-5': { inputPerMillion: 1_250_000, outputPerMillion: 10_000_000 },
  'gpt-5-mini': { inputPerMillion: 250_000, outputPerMillion: 2_000_000 },
  'gpt-4.1': { inputPerMillion: 2_000_000, outputPerMillion: 8_000_000 },
  'gpt-4.1-mini': { inputPerMillion: 400_000, outputPerMillion: 1_600_000 },
  // Modelle ohne bekannte Preisliste (z. B. kostenlose Kontingente) nutzen FALLBACK.
};

const FALLBACK: ModelPrice = { inputPerMillion: 1_000_000, outputPerMillion: 5_000_000 };

export function priceFor(model: string): ModelPrice {
  if (PRICES[model]) return PRICES[model] as ModelPrice;
  const prefix = Object.keys(PRICES).find((k) => model.startsWith(k));
  return prefix ? (PRICES[prefix] as ModelPrice) : FALLBACK;
}

export function costMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return Math.round(
    (inputTokens / 1_000_000) * p.inputPerMillion + (outputTokens / 1_000_000) * p.outputPerMillion,
  );
}
