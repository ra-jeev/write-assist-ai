import { ExtensionContext } from 'vscode';
import { ExtensionManager } from './ExtensionManager';

let extensionManager: ExtensionManager;

export async function activate(context: ExtensionContext) {
  extensionManager = new ExtensionManager(context);
  await extensionManager.initialize();
}

export function deactivate() {}
