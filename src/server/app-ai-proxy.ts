import type { AppAiProvider } from "../lib/app-ai-chain";

type ProviderMap<T> = Record<AppAiProvider, () => Promise<T>>;

export async function runAppAiProviderLadder<T>({
  providerOrder,
  providers,
  onProviderError,
}: {
  providerOrder: readonly AppAiProvider[];
  providers: ProviderMap<T>;
  onProviderError?: (provider: AppAiProvider, error: unknown) => void;
}) {
  let lastError: unknown;

  for (const provider of providerOrder) {
    try {
      return await providers[provider]();
    } catch (error) {
      lastError = error;
      onProviderError?.(provider, error);
    }
  }

  throw lastError ?? new Error("No provider available");
}
