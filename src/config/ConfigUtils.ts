import { ConfigurationChangeEvent, InputBoxOptions, window } from 'vscode';
import { CONFIG_SECTION_KEY } from '../constants';

export function isConfigChanged(
  event: ConfigurationChangeEvent,
  key: string,
): boolean {
  return event.affectsConfiguration(`${CONFIG_SECTION_KEY}.${key}`);
}

export async function promptUserForConfig(options: InputBoxOptions) {
  return window.showInputBox(options);
}
