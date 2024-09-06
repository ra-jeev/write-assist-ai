import { ExtensionContext, SecretStorageChangeEvent, window } from 'vscode';
import type { SecretChangeListener } from '../types';

export class SecretsManager {
  private listeners: Map<string, SecretChangeListener[]> = new Map();

  constructor(private readonly context: ExtensionContext) {
    this.registerSecretsChangeListener();
  }

  async getSecret(key: string) {
    return this.context.secrets.get(key);
  }

  async storeSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }

  registerChangeListener(key: string, listener: SecretChangeListener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }

    this.listeners.get(key)!.push(listener);
  }

  private registerSecretsChangeListener() {
    this.context.secrets.onDidChange(this.onSecretChanged.bind(this));
  }

  private onSecretChanged(event: SecretStorageChangeEvent) {
    const listeners = this.listeners.get(event.key);
    if (listeners) {
      listeners.forEach((listener) => listener(event.key));
    }
  }
}
