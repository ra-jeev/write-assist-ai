import { ConfigurationChangeEvent } from 'vscode';
import { ExtensionConfig } from './ExtensionConfig';
import { isConfigChanged } from './ConfigUtils';
import { ConfigurationKeys } from '../constants';
import type { ExtensionActions, LanguageConfig, WritingAction } from '../types';

export class ActionsConfigManager {
  constructor(private readonly config: ExtensionConfig) { }

  getActions(): ExtensionActions {
    return {
      quickFixes: this.getActionsType(ConfigurationKeys.quickFixes),
      rewriteActions: this.getActionsType(ConfigurationKeys.rewriteOptions),
    };
  }

  private getActionsType(type: string): LanguageConfig<WritingAction[]> {
    const actionsCfg = this.config.getConfiguration<
      Omit<WritingAction, 'id'>[]
    >(type, []);

    const actionType = type.toLowerCase();
    const actions: LanguageConfig<WritingAction[]> = { default: [] };
    for (const languageId in actionsCfg) {
      actions[languageId] = actionsCfg[languageId].map((action, index) => {
        const id = `${actionType}-${languageId}-${index}`;
        return { ...action, id, prompt: action.prompt.trim() };
      });
    }

    return actions;
  }

  hasConfigChanged(event: ConfigurationChangeEvent): boolean {
    return (
      isConfigChanged(event, ConfigurationKeys.quickFixes) ||
      isConfigChanged(event, ConfigurationKeys.rewriteOptions)
    );
  }
}
