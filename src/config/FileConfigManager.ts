import { workspace, Uri, FileSystemWatcher, window } from 'vscode';

import {
  CONFIG_DIR,
  QUICK_FIXES_FILE,
  REWRITE_OPTIONS_FILE,
  SYSTEM_PROMPT_FILE,
  DEFAULT_QUICK_FIXES,
  DEFAULT_REWRITE_OPTIONS,
  DEFAULT_SYSTEM_PROMPT,
  ConfigurationKeys,
} from '../constants';
import type { FileConfigType, FileConfigChangeListener } from '../types';

export class FileConfigManager {
  private listeners: Map<FileConfigType, FileConfigChangeListener[]> =
    new Map();

  private workspaceFolderUri: Uri | undefined;
  private watchers: FileSystemWatcher[] = [];
  private systemPrompt: string | undefined;
  private quickFixes: string | undefined;
  private rewriteOptions: string | undefined;

  private readonly configMap = {
    [SYSTEM_PROMPT_FILE]: ConfigurationKeys.systemPrompt,
    [QUICK_FIXES_FILE]: ConfigurationKeys.quickFixes,
    [REWRITE_OPTIONS_FILE]: ConfigurationKeys.rewriteOptions,
  } as const;

  constructor() {
    this.workspaceFolderUri = workspace.workspaceFolders?.[0]?.uri;
    this.initialize();
  }

  private async initialize() {
    await this.loadAllConfigs();
    this.setupWatchers();
  }

  private getConfigFileUri(filename: string): Uri | undefined {
    if (!this.workspaceFolderUri) {
      return undefined;
    }

    return Uri.joinPath(this.workspaceFolderUri, CONFIG_DIR, filename);
  }

  private async loadConfig(filename: string, configType: FileConfigType) {
    const fileUri = this.getConfigFileUri(filename);
    if (!fileUri) {
      this.setConfigValue(configType, undefined);
      return;
    }

    try {
      const content = await workspace.fs.readFile(fileUri);
      this.setConfigValue(configType, new TextDecoder().decode(content));
    } catch {
      this.setConfigValue(configType, undefined);
    }
  }

  private setConfigValue(type: FileConfigType, value: string | undefined) {
    switch (type) {
      case ConfigurationKeys.systemPrompt:
        this.systemPrompt = value;
        break;
      case ConfigurationKeys.quickFixes:
        this.quickFixes = value;
        break;
      case ConfigurationKeys.rewriteOptions:
        this.rewriteOptions = value;
        break;
    }
  }

  private async loadAllConfigs() {
    await Promise.all([
      this.loadConfig(SYSTEM_PROMPT_FILE, ConfigurationKeys.systemPrompt),
      this.loadConfig(QUICK_FIXES_FILE, ConfigurationKeys.quickFixes),
      this.loadConfig(REWRITE_OPTIONS_FILE, ConfigurationKeys.rewriteOptions),
    ]);
  }

  private setupWatchers() {
    if (!this.workspaceFolderUri) {
      return;
    }

    [SYSTEM_PROMPT_FILE, QUICK_FIXES_FILE, REWRITE_OPTIONS_FILE].forEach(
      (filename) => {
        const fileUri = this.getConfigFileUri(filename);
        if (fileUri) {
          const watcher = workspace.createFileSystemWatcher(fileUri.fsPath);
          watcher.onDidChange(() => this.reloadConfig(filename));
          watcher.onDidCreate(() => this.reloadConfig(filename));
          watcher.onDidDelete(() => this.reloadConfig(filename));
          this.watchers.push(watcher);
        }
      },
    );
  }

  private async reloadConfig(filename: string) {
    const configType = this.configMap[filename as keyof typeof this.configMap];
    if (!configType) {
      return;
    }

    await this.loadConfig(filename, configType);

    this.listeners.get(configType)?.forEach((listener) => listener(configType));
  }

  getConfig(type: FileConfigType) {
    switch (type) {
      case ConfigurationKeys.systemPrompt:
        return this.systemPrompt;
      case ConfigurationKeys.quickFixes:
        return this.quickFixes;
      case ConfigurationKeys.rewriteOptions:
        return this.rewriteOptions;
    }
  }

  dispose() {
    this.watchers.forEach((w) => w.dispose());
  }

  registerChangeListener(
    type: FileConfigType,
    listener: FileConfigChangeListener,
  ) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type)!.push(listener);
  }

  private async ensureConfigDir() {
    if (!this.workspaceFolderUri) {
      window.showErrorMessage('No workspace folder found.');
      return;
    }

    const configDirUri = Uri.joinPath(this.workspaceFolderUri, CONFIG_DIR);
    await workspace.fs.createDirectory(configDirUri);
    return configDirUri;
  }

  async maybeOverwrite(fileUri: Uri): Promise<boolean> {
    try {
      const fileStat = await workspace.fs.stat(fileUri);
      const answer = await window.showWarningMessage(
        `File ${fileUri.path} already exists. Overwrite?`,
        { modal: true },
        'Yes',
        'No',
      );
      return answer === 'Yes';
    } catch (error) {
      if (error instanceof Error && error.name === 'FileSystemError') {
        return true;
      }

      console.warn('Unexpected error checking file existence:', error);
      return true;
    }
  }

  private async createConfigFile(
    filename: string,
    defaultContent: string | object,
    isJson: boolean = false,
  ) {
    const configDirUri = await this.ensureConfigDir();
    if (!configDirUri) {
      return;
    }

    const fileUri = Uri.joinPath(configDirUri, filename);
    if (!(await this.maybeOverwrite(fileUri))) {
      return;
    }

    try {
      const content = isJson
        ? JSON.stringify(defaultContent, null, 2)
        : String(defaultContent);

      await workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
      await window.showTextDocument(fileUri);
    } catch (err) {
      window.showErrorMessage(`Failed to create ${filename}: ${String(err)}`);
    }
  }

  async createSystemPromptFile() {
    await this.createConfigFile(SYSTEM_PROMPT_FILE, DEFAULT_SYSTEM_PROMPT);
  }

  async createQuickFixesFile() {
    await this.createConfigFile(QUICK_FIXES_FILE, DEFAULT_QUICK_FIXES, true);
  }

  async createRewriteOptionsFile() {
    await this.createConfigFile(REWRITE_OPTIONS_FILE, DEFAULT_REWRITE_OPTIONS, true);
  }
}
