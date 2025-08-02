import { ConfigurationChangeEvent } from 'vscode';
import { ExtensionConfig } from './ExtensionConfig';
import { SecretsManager } from './SecretsManager';
import { isConfigChanged, promptUserForConfig } from './ConfigUtils';
import {
  ConfigurationKeys,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MODEL,
} from '../constants';
import type { OpenAIConfig } from '../types';

export class OpenAIConfigManager {
  private changeListener: ((resetOpenAISvc: boolean) => any) | undefined;

  constructor(
    private readonly config: ExtensionConfig,
    private readonly secretsManager: SecretsManager
  ) {
    this.secretsManager.registerChangeListener(
      ConfigurationKeys.openAiApiKey,
      this.onApiKeyChanged.bind(this)
    );
  }

  async getApiKey(): Promise<string | undefined> {
    return this.secretsManager.getSecret(ConfigurationKeys.openAiApiKey);
  }

  async promptUserForApiKey(): Promise<string | undefined> {
    const apiKey = await promptUserForConfig({
      title: 'Your OpenAI API Key',
      prompt: 'Enter your API key here',
      placeHolder: 'sk-xxxxxxxxxxxxxxxx',
      password: true,
      ignoreFocusOut: true,
    });

    // user might enter empty string to reset the key, so check against undefined
    if (apiKey === undefined) {
      console.log('No API key provided by user');
      return;
    }

    await this.secretsManager.storeSecret(
      ConfigurationKeys.openAiApiKey,
      apiKey
    );

    return apiKey;
  }

  getConfig(): OpenAIConfig {
    const maxTokens = this.config.getConfiguration<number>(
      ConfigurationKeys.maxTokens,
      DEFAULT_MAX_TOKENS
    );

    const temperature = this.config.getConfiguration<number>(
      ConfigurationKeys.temperature,
      DEFAULT_TEMPERATURE
    );

    const systemPrompt = this.config.getConfiguration<string>(
      ConfigurationKeys.systemPrompt,
      ''
    );

    let model = this.config.getConfiguration<string>(
      ConfigurationKeys.model,
      DEFAULT_MODEL
    );

    if (model.default === 'custom') {
      model = this.config.getConfiguration<string>(
        ConfigurationKeys.customModel,
        DEFAULT_MODEL
      );

      if (!model.default) {
        model.default = DEFAULT_MODEL;
      }
    }

    return {
      maxTokens: maxTokens.default,
      model: model.default,
      temperature: temperature.default,
      systemPrompt,
    };
  }

  getProxyUrl(): string | undefined {
    return this.config.getConfiguration<string>(ConfigurationKeys.proxyUrl, '')
      .default;
  }

  hasConfigChanged(event: ConfigurationChangeEvent): boolean {
    return (
      isConfigChanged(event, ConfigurationKeys.model) ||
      isConfigChanged(event, ConfigurationKeys.customModel) ||
      isConfigChanged(event, ConfigurationKeys.maxTokens) ||
      isConfigChanged(event, ConfigurationKeys.temperature) ||
      isConfigChanged(event, ConfigurationKeys.systemPrompt) ||
      isConfigChanged(event, ConfigurationKeys.proxyUrl)
    );
  }

  notifyConfigChanged(event: ConfigurationChangeEvent) {
    if (this.changeListener) {
      const resetOpenAISvc = isConfigChanged(event, ConfigurationKeys.proxyUrl);

      this.changeListener(resetOpenAISvc);
    }
  }

  registerChangeListener(listener: (resetOpenAISvc: boolean) => any) {
    this.changeListener = listener;
  }

  private onApiKeyChanged(key: string) {
    if (this.changeListener && key === ConfigurationKeys.openAiApiKey) {
      this.changeListener(true);
    }
  }
}
