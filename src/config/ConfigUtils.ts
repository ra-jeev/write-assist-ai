import { ConfigurationChangeEvent, InputBoxOptions, window } from 'vscode';
import { ExtensionConfig } from './ExtensionConfig';

export function isConfigChanged(
  event: ConfigurationChangeEvent,
  key: string
): boolean {
  return event.affectsConfiguration(`${ExtensionConfig.sectionKey}.${key}`);
}

export async function promptUserForConfig(options: InputBoxOptions) {
  return window.showInputBox(options);
}
