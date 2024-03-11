import { SecretStorage, window, workspace } from 'vscode';

enum ConfigurationKeys {
  deprecatedOpenAiApiKey = 'openAiApiKey',
  openAiApiKey = 'openAi.apiKey',
  maxTokens = 'maxTokens',
}

export class ExtensionConfig {
  public static readonly sectionKey = 'writeAssistAi';
  private readonly secrets: SecretStorage;

  constructor(secrets: SecretStorage) {
    this.secrets = secrets;
    this.migrateOpenAiApiKeyConfig();
  }

  getConfiguration<T>(key: string) {
    return workspace.getConfiguration(ExtensionConfig.sectionKey).get<T>(key);
  }

  async updateConfiguration(key: string, value: any) {
    try {
      // Update in global settings
      await workspace
        .getConfiguration(ExtensionConfig.sectionKey)
        .update(key, value, true);
    } catch (error) {
      console.error(`No global configuration for ${key}`, error);
    }

    try {
      // Update in workspace settings
      await workspace
        .getConfiguration(ExtensionConfig.sectionKey)
        .update(key, value);
    } catch (error) {
      console.error(`No workspace configuration for ${key}`, error);
    }
  }

  async migrateOpenAiApiKeyConfig(): Promise<void> {
    const apiKey = this.getConfiguration<string>(
      ConfigurationKeys.deprecatedOpenAiApiKey
    );

    if (apiKey) {
      // Store the key in the secretStorage
      await this.storeOpenAiApiKey(apiKey);

      // Delete the key from the settings
      await this.updateConfiguration(
        ConfigurationKeys.deprecatedOpenAiApiKey,
        undefined
      );
    }
  }

  async getOpenAiApiKey() {
    return this.secrets.get(ConfigurationKeys.openAiApiKey);
  }

  async storeOpenAiApiKey(apiKey: string) {
    return this.secrets.store(ConfigurationKeys.openAiApiKey, apiKey);
  }

  async promptUserForApiKey() {
    const apiKey = await window.showInputBox({
      title: 'Your OpenAI API Key',
      prompt: 'Enter your API key here',
      placeHolder: 'sk-xxxxxxxxxxxxxxxx',
      password: true,
      ignoreFocusOut: true,
    });

    if (!apiKey) {
      console.log('No API key provided by user');
      return;
    }

    await this.storeOpenAiApiKey(apiKey);

    return apiKey;
  }

  getOpenAIConfig() {
    const maxTokens = this.getConfiguration<number>(
      ConfigurationKeys.maxTokens
    );

    return {
      maxTokens,
    };
  }
}
