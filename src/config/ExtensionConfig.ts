import { ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { OpenAIConfigManager } from './OpenAIConfigManager';
import { ActionsConfigManager } from './ActionsConfigManager';
import { SecretsManager } from './SecretsManager';
import { CONFIG_SECTION_KEY } from '../constants';
import type {
  CommandsChangeListener,
  ExtensionActions,
  LanguageConfig,
  OpenAIConfig,
} from '../types';

export class ExtensionConfig {
  private openAIConfig: OpenAIConfigManager;
  private actionsConfig: ActionsConfigManager;
  private secretsManager: SecretsManager;

  constructor(
    private readonly context: ExtensionContext,
    private readonly cmdsChangeListener: CommandsChangeListener
  ) {
    this.secretsManager = new SecretsManager(this.context);
    this.openAIConfig = new OpenAIConfigManager(this, this.secretsManager);
    this.actionsConfig = new ActionsConfigManager(this);

    this.registerConfigChangeListener();
    this.openAIConfig.migrateApiKey();
  }

  getConfiguration<T>(key: string, defaultValue: T): LanguageConfig<T> {
    const workspaceConfig = workspace.getConfiguration(CONFIG_SECTION_KEY);

    const value: LanguageConfig<T> = {
      default: workspaceConfig.get<T>(key, defaultValue),
    };

    const inspectedValue = workspaceConfig.inspect<T>(key);
    if (inspectedValue?.languageIds) {
      for (const languageId of inspectedValue.languageIds) {
        value[languageId] = workspace
          .getConfiguration(CONFIG_SECTION_KEY, { languageId })
          .get(key) as T;
      }
    }

    return value;
  }

  async updateConfiguration(key: string, value: any) {
    try {
      // Update in global settings
      await workspace
        .getConfiguration(CONFIG_SECTION_KEY)
        .update(key, value, true);
    } catch (error) {
      console.error(`No global configuration for ${key}`, error);
    }

    try {
      // Update in workspace settings
      await workspace.getConfiguration(CONFIG_SECTION_KEY).update(key, value);
    } catch (error) {
      console.error(`No workspace configuration for ${key}`, error);
    }
  }

  getOpenAIConfig(): OpenAIConfig {
    return this.openAIConfig.getConfig();
  }

  getOpenAIProxyUrl(): string | undefined {
    return this.openAIConfig.getProxyUrl();
  }

  getActions(): ExtensionActions {
    return this.actionsConfig.getActions();
  }

  async getOpenAiApiKey() {
    return this.openAIConfig.getApiKey();
  }

  async promptUserForApiKey() {
    return this.openAIConfig.promptUserForApiKey();
  }

  registerOpenAiConfigChangeListener(
    listener: (resetOpenAISvc: boolean) => any
  ) {
    this.openAIConfig.registerChangeListener(listener);
  }

  private registerConfigChangeListener() {
    workspace.onDidChangeConfiguration((event) =>
      this.onConfigurationChanged(event)
    );
  }

  private onConfigurationChanged(event: ConfigurationChangeEvent) {
    if (this.actionsConfig.hasConfigChanged(event)) {
      this.cmdsChangeListener();
    } else if (this.openAIConfig.hasConfigChanged(event)) {
      this.openAIConfig.notifyConfigChanged(event);
    }
  }
}
