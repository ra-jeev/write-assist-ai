import { ExtensionContext } from 'vscode';
import { ExtensionManager } from './ExtensionManager';

let extensionManager: ExtensionManager;

export function activate(context: ExtensionContext) {
  extensionManager = new ExtensionManager(context);
}

export function deactivate() {}
