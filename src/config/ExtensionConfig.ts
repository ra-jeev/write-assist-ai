import { ExtensionContext, workspace, ConfigurationChangeEvent } from 'vscode';
import { OpenAIConfigManager } from './OpenAIConfigManager';
import { ActionsConfigManager } from './ActionsConfigManager';
import { SecretsManager } from './SecretsManager';
import { FileConfigManager } from './FileConfigManager';
import { isConfigChanged } from './ConfigUtils';
import { CONFIG_SECTION_KEY, ConfigurationKeys } from '../constants';
import type {
  CommandsChangeListener,
  ExtensionActions,
  FileConfigType,
  LanguageConfig,
  OpenAIConfig,
  OpenAIConfigChangeListener,
} from '../types';

export class ExtensionConfig {
  private openAIConfig: OpenAIConfigManager;
  private actionsConfig: ActionsConfigManager;
  private secretsManager: SecretsManager;
  private fileConfigManager: FileConfigManager;
  private separator = '';
  private useAcceptRejectFlow = true;

  constructor(
    private readonly context: ExtensionContext,
    private readonly cmdsChangeListener: CommandsChangeListener,
  ) {
    this.secretsManager = new SecretsManager(this.context);
    this.openAIConfig = new OpenAIConfigManager(this);
    this.actionsConfig = new ActionsConfigManager(this);
    this.fileConfigManager = new FileConfigManager();

    this.registerAllListeners();
    this.updateUseAcceptRejectFlow();
    this.initSeparator();
  }

  private initSeparator() {
    this.separator = this.getConfiguration(
      ConfigurationKeys.separator,
      '',
    ).default;
  }

  private updateUseAcceptRejectFlow() {
    this.useAcceptRejectFlow = this.getConfiguration(
      ConfigurationKeys.useAcceptRejectFlow,
      true,
    ).default;
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

  getSecret(key: string): Promise<string | undefined> {
    return this.secretsManager.getSecret(key);
  }

  setSecret(key: string, value: string): Promise<void> {
    return this.secretsManager.storeSecret(key, value);
  }

  getFileConfig(type: FileConfigType): string | undefined {
    return this.fileConfigManager.getConfig(type);
  }

  getOpenAIConfig(): OpenAIConfig {
    return this.openAIConfig.getConfig();
  }

  getSystemPrompt(): LanguageConfig<string> {
    return this.openAIConfig.getSystemPrompt();
  }

  getOpenAIProxyUrl(): string {
    return this.openAIConfig.getProxyUrl();
  }

  getSeparator(): string {
    return this.separator;
  }

  getUseAcceptRejectFlow(): boolean {
    return this.useAcceptRejectFlow;
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

  registerOpenAiConfigChangeListener(listener: OpenAIConfigChangeListener) {
    this.openAIConfig.registerChangeListener(listener);
  }

  private registerAllListeners() {
    this.registerConfigChangeListener();

    this.secretsManager.registerChangeListener(
      ConfigurationKeys.openAiApiKey,
      () => this.openAIConfig.onApiKeyChanged(),
    );

    this.fileConfigManager.registerChangeListener(
      ConfigurationKeys.systemPrompt,
      () => this.openAIConfig.onSystemPromptFileChanged(),
    );

    this.fileConfigManager.registerChangeListener(
      ConfigurationKeys.quickFixes,
      () => this.cmdsChangeListener(),
    );

    this.fileConfigManager.registerChangeListener(
      ConfigurationKeys.rewriteOptions,
      () => this.cmdsChangeListener(),
    );
  }

  private registerConfigChangeListener() {
    workspace.onDidChangeConfiguration((event) =>
      this.onConfigurationChanged(event),
    );
  }

  private onConfigurationChanged(event: ConfigurationChangeEvent) {
    if (this.actionsConfig.hasConfigChanged(event)) {
      this.cmdsChangeListener();
    } else if (this.openAIConfig.hasConfigChanged(event)) {
      this.openAIConfig.notifyConfigChanged(event);
    } else if (isConfigChanged(event, ConfigurationKeys.separator)) {
      this.initSeparator();
    } else if (isConfigChanged(event, ConfigurationKeys.useAcceptRejectFlow)) {
      this.updateUseAcceptRejectFlow();
    }
  }

  createSystemPromptFile() {
    this.fileConfigManager.createSystemPromptFile();
  }

  createQuickFixesFile() {
    this.fileConfigManager.createQuickFixesFile();
  }

  createRewriteOptionsFile() {
    this.fileConfigManager.createRewriteOptionsFile();
  }
}
