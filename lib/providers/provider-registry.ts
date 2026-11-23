import type { ModelProvider } from "./model-provider.ts";
import { ProviderError } from "./provider-errors.ts";

export class ProviderRegistry {
  #providers = new Map<string, Map<string, ModelProvider>>();
  #default?: ModelProvider;

  register(provider: ModelProvider) {
    const models = this.#providers.get(provider.providerId) ?? new Map<string, ModelProvider>();
    if (models.has(provider.modelId)) throw new ProviderError("configuration");
    models.set(provider.modelId, provider);
    this.#providers.set(provider.providerId, models);
    this.#default ??= provider;
  }

  select(providerId = this.#default?.providerId, modelId?: string): ModelProvider {
    const models = providerId && this.#providers.get(providerId);
    if (!models) throw new ProviderError("unknown_model");
    const fallback = providerId === this.#default?.providerId ? this.#default : models.values().next().value;
    const provider = modelId === undefined ? fallback : models.get(modelId);
    if (!provider) throw new ProviderError("unknown_model");
    return provider;
  }

  setDefault(providerId: string, modelId?: string) { this.#default = this.select(providerId, modelId); }
  capabilities(providerId?: string, modelId?: string) { return [...this.select(providerId, modelId).formats]; }
}
