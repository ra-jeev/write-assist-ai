import { workspace, Uri, FileSystemWatcher, window } from 'vscode';
import fs from 'fs/promises';
import path from 'path';

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

  private workspaceFolder: string | undefined;
  private watchers: FileSystemWatcher[] = [];
  private systemPrompt: string | undefined;
  private quickFixes: string | undefined;
  private rewriteOptions: string | undefined;

  constructor() {
    this.workspaceFolder = workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.init();
  }

  private async init() {
    await this.loadAllConfigs();
    this.setupWatchers();
  }

  private getConfigFilePath(filename: string): string | undefined {
    if (!this.workspaceFolder) {
      return undefined;
    }

    return path.join(this.workspaceFolder, CONFIG_DIR, filename);
  }

  private async loadAllConfigs() {
    await Promise.all([
      this.loadSystemPrompt(),
      this.loadQuickFixes(),
      this.loadRewriteOptions(),
    ]);
  }

  async loadSystemPrompt() {
    const filePath = this.getConfigFilePath(SYSTEM_PROMPT_FILE);
    if (!filePath) {
      return;
    }

    try {
      this.systemPrompt = await fs.readFile(filePath, 'utf8');
    } catch {
      this.systemPrompt = undefined;
    }
  }

  async loadQuickFixes() {
    const filePath = this.getConfigFilePath(QUICK_FIXES_FILE);
    if (!filePath) {
      return;
    }

    try {
      this.quickFixes = await fs.readFile(filePath, 'utf8');
    } catch {
      this.quickFixes = undefined;
    }
  }

  async loadRewriteOptions() {
    const filePath = this.getConfigFilePath(REWRITE_OPTIONS_FILE);
    if (!filePath) {
      return;
    }

    try {
      this.rewriteOptions = await fs.readFile(filePath, 'utf8');
    } catch {
      this.rewriteOptions = undefined;
    }
  }

  private setupWatchers() {
    if (!this.workspaceFolder) {
      return;
    }

    const configDirUri = Uri.file(path.join(this.workspaceFolder, CONFIG_DIR));

    [SYSTEM_PROMPT_FILE, QUICK_FIXES_FILE, REWRITE_OPTIONS_FILE].forEach(
      (filename) => {
        const fileUri = Uri.file(path.join(configDirUri.fsPath, filename));
        const watcher = workspace.createFileSystemWatcher(fileUri.fsPath);
        watcher.onDidChange(() => this.reloadConfig(filename));
        watcher.onDidCreate(() => this.reloadConfig(filename));
        watcher.onDidDelete(() => this.reloadConfig(filename));
        this.watchers.push(watcher);
      },
    );
  }

  private async reloadConfig(filename: string) {
    let configType: FileConfigType | undefined;

    switch (filename) {
      case SYSTEM_PROMPT_FILE:
        await this.loadSystemPrompt();
        configType = ConfigurationKeys.systemPrompt;
        break;
      case QUICK_FIXES_FILE:
        await this.loadQuickFixes();
        configType = ConfigurationKeys.quickFixes;
        break;
      case REWRITE_OPTIONS_FILE:
        await this.loadRewriteOptions();
        configType = ConfigurationKeys.rewriteOptions;
        break;
    }

    if (configType && this.listeners.has(configType)) {
      this.listeners
        .get(configType)!
        .forEach((listener) => listener(configType));
    }
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
    if (!this.workspaceFolder) {
      window.showErrorMessage('No workspace folder found.');
      return;
    }

    const configDir = path.join(this.workspaceFolder, CONFIG_DIR);
    try {
      await fs.mkdir(configDir, { recursive: true });
      return configDir;
    } catch (err) {
      window.showErrorMessage(
        'Failed to create config directory: ' + String(err),
      );
      return;
    }
  }

  async maybeOverwrite(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      const answer = await window.showWarningMessage(
        `File ${path.basename(filePath)} already exists. Overwrite?`,
        { modal: true },
        'Yes',
        'No',
      );
      return answer === 'Yes';
    } catch {
      return true;
    }
  }

  async createSystemPromptFile() {
    const configDir = await this.ensureConfigDir();
    if (!configDir) {
      return;
    }

    const filePath = path.join(configDir, SYSTEM_PROMPT_FILE);
    if (!(await this.maybeOverwrite(filePath))) {
      return;
    }

    try {
      await fs.writeFile(filePath, DEFAULT_SYSTEM_PROMPT, { encoding: 'utf8' });
      await window.showTextDocument(Uri.file(filePath));
    } catch (err) {
      window.showErrorMessage(
        'Failed to create system prompt file: ' + String(err),
      );
    }
  }

  async createQuickFixesFile() {
    const configDir = await this.ensureConfigDir();
    if (!configDir) {
      return;
    }

    const filePath = path.join(configDir, QUICK_FIXES_FILE);
    if (!(await this.maybeOverwrite(filePath))) {
      return;
    }

    try {
      await fs.writeFile(
        filePath,
        JSON.stringify(DEFAULT_QUICK_FIXES, null, 2),
        { encoding: 'utf8' },
      );
      window.showInformationMessage('Quick fixes file created at ' + filePath);
    } catch (err) {
      window.showErrorMessage(
        'Failed to create quick fixes file: ' + String(err),
      );
    }
  }

  async createRewriteOptionsFile() {
    const configDir = await this.ensureConfigDir();
    if (!configDir) {
      return;
    }

    const filePath = path.join(configDir, REWRITE_OPTIONS_FILE);
    if (!(await this.maybeOverwrite(filePath))) {
      return;
    }

    try {
      await fs.writeFile(
        filePath,
        JSON.stringify(DEFAULT_REWRITE_OPTIONS, null, 2),
        { encoding: 'utf8' },
      );
      window.showInformationMessage(
        'Rewrite options file created at ' + filePath,
      );
    } catch (err) {
      window.showErrorMessage(
        'Failed to create rewrite options file: ' + String(err),
      );
    }
  }
}
