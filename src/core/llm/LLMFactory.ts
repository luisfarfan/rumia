import type { LLMProvider } from './types.js';
import { CLIProxyProvider } from './providers/CLIProxyProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { CodexProvider } from './providers/CodexProvider.js';
import { AntigravityProvider } from './providers/AntigravityProvider.js';

export class LLMFactory {
  private static chatProviderInstance: LLMProvider | null = null;
  private static embeddingProviderInstance: LLMProvider | null = null;

  private static createProvider(providerName: string): LLMProvider {
    switch (providerName.toLowerCase()) {
      case 'openrouter':
        console.log('[LLMFactory] Instantiating OpenRouterProvider');
        return new OpenRouterProvider();
      case 'codex':
        console.log('[LLMFactory] Instantiating CodexProvider');
        return new CodexProvider();
      case 'antigravity':
        console.log('[LLMFactory] Instantiating AntigravityProvider');
        return new AntigravityProvider();
      case 'cliproxyapi':
      default:
        console.log('[LLMFactory] Instantiating CLIProxyProvider (Default)');
        return new CLIProxyProvider();
    }
  }

  static getChatProvider(): LLMProvider {
    if (!this.chatProviderInstance) {
      const providerName = process.env.CHAT_LLM_PROVIDER || 'cliproxyapi';
      this.chatProviderInstance = this.createProvider(providerName);
    }
    return this.chatProviderInstance;
  }

  static getEmbeddingProvider(): LLMProvider {
    if (!this.embeddingProviderInstance) {
      const providerName = process.env.EMBEDDING_LLM_PROVIDER || 'cliproxyapi';
      this.embeddingProviderInstance = this.createProvider(providerName);
    }
    return this.embeddingProviderInstance;
  }
}
