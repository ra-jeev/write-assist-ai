import {
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  SecretStorageChangeEvent,
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
  quickFixes: LanguageConfig<WritingAction[]>;
  rewriteActions: LanguageConfig<WritingAction[]>;
};

export type LanguageConfig<T> = {
  [key: string]: T;
  default: T;
};

// Keys for the extensions configuration settings
export enum ConfigurationKeys {
  deprecatedOpenAiApiKey = 'openAiApiKey',
  openAiApiKey = 'openAi.apiKey',
  maxTokens = 'maxTokens',
  temperature = 'temperature',
  model = 'openAi.model',
  customModel = 'openAi.customModel',
  quickFixes = 'quickFixes',
  rewriteOptions = 'rewriteOptions',
  systemPrompt = 'systemPrompt',
}

// Keys for the VSCode Command Pallette Commands
// that this extension provides
enum CommandKeys {
  openAiApiKey = 'openAiApiKey',
}

const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_OPENAI_MODEL = 'gpt-4';

export class ExtensionConfig {
  public static readonly sectionKey = 'writeAssistAi';
  public static readonly openAiApiKeyCmd = `${ExtensionConfig.sectionKey}.${CommandKeys.openAiApiKey}`;
  private readonly context: ExtensionContext;
  private readonly cmdKeysListener: (
    ctx: ExtensionContext,
    config: ExtensionConfig
  ) => any;
  private openAiConfigChangeListener:
    | ((isApiKeyChange: boolean) => any)
    | undefined;

  constructor(
    context: ExtensionContext,
    cmdKeysListener: (ctx: ExtensionContext, config: ExtensionConfig) => any
  ) {
    this.context = context;
    this.cmdKeysListener = cmdKeysListener;

    this.registerConfigChangeListener();
    this.registerSecretsChangeListener();
    this.migrateOpenAiApiKeyConfig();
  }

  getConfiguration<T>(key: string, defaultValue: T) {
    const workspaceConfig = workspace.getConfiguration(
      ExtensionConfig.sectionKey
    );

    const value: LanguageConfig<T> = {
      default: workspaceConfig.get<T>(key, defaultValue),
    };

    const inspectedValue = workspaceConfig.inspect<T>(key);
    if (inspectedValue?.languageIds) {
      for (const languageId of inspectedValue.languageIds) {
        value[languageId] = workspace
          .getConfiguration(ExtensionConfig.sectionKey, { languageId })
          .get(key) as T;
      }
    }

    return value;
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

    if (apiKey.default) {
      // Store the key in the secretStorage
      await this.storeOpenAiApiKey(apiKey.default);

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

    // user might enter empty string to reset the key, so check against undefined
    if (apiKey === undefined) {
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

    const systemPrompt = this.getConfiguration<string>(
      ConfigurationKeys.systemPrompt,
      ''
    );

    let model = this.getConfiguration<string>(
      ConfigurationKeys.model,
      DEFAULT_OPENAI_MODEL
    );

    if (model.default === 'custom') {
      model = this.getConfiguration<string>(
        ConfigurationKeys.customModel,
        DEFAULT_OPENAI_MODEL
      );

      if (!model.default) {
        model.default = DEFAULT_OPENAI_MODEL;
      }
    }

    return {
      maxTokens: maxTokens.default,
      model: model.default,
      temperature: temperature.default,
      systemPrompt,
    };
  }

  getActionsType(type: string): LanguageConfig<WritingAction[]> {
    const actionsCfg = this.getConfiguration<Omit<WritingAction, 'id'>[]>(
      type,
      []
    );

    const actions: LanguageConfig<WritingAction[]> = { default: [] };
    for (const languageId in actionsCfg) {
      actions[languageId] = actionsCfg[languageId].map((action, index) => {
        const id = `${type.toLowerCase()}-${languageId}-${index}`;
        return { ...action, id, prompt: action.prompt.trim() };
      });
    }

    return actions;
  }

  getActions(): ExtensionActions {
    const quickFixes = this.getActionsType(ConfigurationKeys.quickFixes);

    const rewriteActions = this.getActionsType(
      ConfigurationKeys.rewriteOptions
    );

    return { quickFixes, rewriteActions };
  }

  onConfigurationChanged(event: ConfigurationChangeEvent) {
    const configCmdKeys = [
      ConfigurationKeys.quickFixes,
      ConfigurationKeys.rewriteOptions,
    ];

    const configOpenAiKeys = [
      ConfigurationKeys.maxTokens,
      ConfigurationKeys.temperature,
      ConfigurationKeys.model,
      ConfigurationKeys.customModel,
      ConfigurationKeys.systemPrompt,
    ];

    // First look for changes in the Commands Config
    for (const configKey of configCmdKeys) {
      if (
        event.affectsConfiguration(`${ExtensionConfig.sectionKey}.${configKey}`)
      ) {
        this.cmdKeysListener(this.context, this);
        return;
      }
    }

    if (this.openAiConfigChangeListener) {
      for (const configKey of configOpenAiKeys) {
        if (
          event.affectsConfiguration(
            `${ExtensionConfig.sectionKey}.${configKey}`
          )
        ) {
          // as soon as we find one change, we bail out
          this.openAiConfigChangeListener(false);
          return;
        }
      }
    }
  }

  registerConfigChangeListener() {
    workspace.onDidChangeConfiguration((event) =>
      this.onConfigurationChanged(event)
    );
  }

  onSecretChanged(event: SecretStorageChangeEvent) {
    if (
      event.key === ConfigurationKeys.openAiApiKey &&
      this.openAiConfigChangeListener
    ) {
      this.openAiConfigChangeListener(true);
    }
  }

  registerSecretsChangeListener() {
    this.context.secrets.onDidChange((event) => this.onSecretChanged(event));
  }

  registerOpenAiConfigChangeListener(
    listener: (isApiKeyChange: boolean) => any
  ) {
    this.openAiConfigChangeListener = listener;
    this.context.subscriptions.push(
      new Disposable(() => (this.openAiConfigChangeListener = undefined))
    );
  }
}
