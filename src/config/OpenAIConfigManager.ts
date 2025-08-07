import { ConfigurationChangeEvent } from 'vscode';
import { ExtensionConfig } from './ExtensionConfig';
import { isConfigChanged, promptUserForConfig } from './ConfigUtils';
import {
  ConfigurationKeys,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MODEL,
} from '../constants';
import type { LanguageConfig, OpenAIConfig, OpenAIConfigChangeListener } from '../types';

export class OpenAIConfigManager {
  private changeListener: OpenAIConfigChangeListener | undefined;
  private apiKey: string | undefined;

  constructor(private readonly config: ExtensionConfig) { }

  async getApiKey(): Promise<string | undefined> {
    if (!this.apiKey) {
      this.apiKey = await this.config.getSecret(ConfigurationKeys.openAiApiKey);
    }

    return this.apiKey;
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

    await this.config.setSecret(
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
    };
  }

  getProxyUrl(): string {
    return this.config.getConfiguration<string>(ConfigurationKeys.proxyUrl, '')
      .default;
  }

  getSystemPrompt(): LanguageConfig<string> {
    const fileSystemPrompt = this.config.getFileConfig(ConfigurationKeys.systemPrompt);
    if (fileSystemPrompt) {
      return { default: fileSystemPrompt };
    }
    
    return this.config.getConfiguration<string>(
      ConfigurationKeys.systemPrompt,
      ''
    );
  };

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
      const isProxyUrlChange = isConfigChanged(event, ConfigurationKeys.proxyUrl);
      const isSystemPromptChange = isConfigChanged(event, ConfigurationKeys.systemPrompt);

      this.changeListener(isProxyUrlChange ? 'reset' : isSystemPromptChange ? 'systemPrompt' : 'config');
    }
  }

  registerChangeListener(listener: OpenAIConfigChangeListener) {
    this.changeListener = listener;
  }

  onApiKeyChanged() {
    if (this.changeListener) {
      this.changeListener('reset');
    }
  }

  onSystemPromptFileChanged() {
    if (this.changeListener) {
      this.changeListener('systemPrompt');
    }
  }
}
