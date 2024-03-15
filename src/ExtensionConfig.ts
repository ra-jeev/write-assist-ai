import {
  ConfigurationChangeEvent,
  ExtensionContext,
  window,
  workspace,
} from 'vscode';
import { type OpenAiConfig } from './services/OpenAiService';

export type WritingAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export type ExtensionActions = {
  quickFixes: WritingAction[];
  rewriteActions: WritingAction[];
};

enum ConfigurationKeys {
  deprecatedOpenAiApiKey = 'openAiApiKey',
  openAiApiKey = 'openAi.apiKey',
  maxTokens = 'maxTokens',
  temperature = 'temperature',
  model = 'openAi.model',
  customModel = 'openAi.customModel',
  quickFixes = 'quickFixes',
  rewriteOptions = 'rewriteOptions',
}

const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_OPENAI_MODEL = 'gpt-4';

export class ExtensionConfig {
  public static readonly sectionKey = 'writeAssistAi';
  private readonly commandConfigKeys = [
    ConfigurationKeys.quickFixes,
    ConfigurationKeys.rewriteOptions,
  ];
  private readonly context: ExtensionContext;
  private readonly listener: (
    ctx: ExtensionContext,
    config: ExtensionConfig
  ) => any;

  constructor(
    context: ExtensionContext,
    listener: (ctx: ExtensionContext, config: ExtensionConfig) => any
  ) {
    this.context = context;
    this.listener = listener;
    this.registerConfigChangeListener();
    this.migrateOpenAiApiKeyConfig();
  }

  getConfiguration<T>(key: string, defaultValue: T) {
    return workspace
      .getConfiguration(ExtensionConfig.sectionKey)
      .get<T>(key, defaultValue);
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
      ConfigurationKeys.deprecatedOpenAiApiKey,
      ''
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
    return this.context.secrets.get(ConfigurationKeys.openAiApiKey);
  }

  async storeOpenAiApiKey(apiKey: string) {
    return this.context.secrets.store(ConfigurationKeys.openAiApiKey, apiKey);
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

  getOpenAIConfig(): OpenAiConfig {
    const maxTokens = this.getConfiguration<number>(
      ConfigurationKeys.maxTokens,
      DEFAULT_MAX_TOKENS
    );

    const temperature = this.getConfiguration<number>(
      ConfigurationKeys.temperature,
      DEFAULT_TEMPERATURE
    );

    const model = this.getConfiguration<string>(
      ConfigurationKeys.model,
      DEFAULT_OPENAI_MODEL
    );

    if (model === 'custom') {
      let customModel = this.getConfiguration<string>(
        ConfigurationKeys.customModel,
        DEFAULT_OPENAI_MODEL
      );

      if (!customModel) {
        customModel = DEFAULT_OPENAI_MODEL;
      }

      return {
        maxTokens,
        model: customModel,
        temperature,
      };
    }

    return {
      maxTokens,
      model,
      temperature,
    };
  }

  getActions(): ExtensionActions {
    const fixes = this.getConfiguration<Omit<WritingAction, 'id'>[]>(
      ConfigurationKeys.quickFixes,
      []
    );

    const quickFixes = fixes.map((fix, index) => {
      return { ...fix, id: `quick-${index}` };
    });

    const actions = this.getConfiguration<Omit<WritingAction, 'id'>[]>(
      ConfigurationKeys.rewriteOptions,
      []
    );

    const rewriteActions = actions.map((action, index) => {
      return { ...action, id: `rewrite-${index}` };
    });

    return { quickFixes, rewriteActions };
  }

  onConfigurationChanged(event: ConfigurationChangeEvent) {
    for (const configKey of this.commandConfigKeys) {
      if (
        event.affectsConfiguration(`${ExtensionConfig.sectionKey}.${configKey}`)
      ) {
        this.listener(this.context, this);
        return;
      }
    }
  }

  registerConfigChangeListener() {
    workspace.onDidChangeConfiguration((event) =>
      this.onConfigurationChanged(event)
    );
  }
}
