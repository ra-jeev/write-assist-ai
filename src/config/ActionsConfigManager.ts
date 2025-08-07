import { ConfigurationChangeEvent, window } from 'vscode';
import { ExtensionConfig } from './ExtensionConfig';
import { isConfigChanged } from './ConfigUtils';
import { ConfigurationKeys } from '../constants';
import type {
  FileConfigType,
  ExtensionActions,
  LanguageConfig,
  WritingAction,
} from '../types';

export class ActionsConfigManager {
  constructor(private readonly config: ExtensionConfig) {}

  getActions(): ExtensionActions {
    return {
      quickFixes: this.getActionsType(ConfigurationKeys.quickFixes),
      rewriteOptions: this.getActionsType(ConfigurationKeys.rewriteOptions),
    };
  }

  private isWritingActionArray(
    arr: unknown,
  ): arr is Omit<WritingAction, 'id'>[] {
    if (!Array.isArray(arr)) {
      return false;
    }

    return arr.every((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      const action = item as any;
      return (
        typeof action.title === 'string' &&
        action.title.trim() !== '' &&
        typeof action.description === 'string' &&
        action.description.trim() !== '' &&
        typeof action.prompt === 'string' &&
        action.prompt.trim() !== ''
      );
    });
  }

  private getActionsType(
    type: Omit<FileConfigType, ConfigurationKeys.systemPrompt>,
  ): LanguageConfig<WritingAction[]> {
    let actionsWithoutId:
      | LanguageConfig<Omit<WritingAction, 'id'>[]>
      | undefined;
    const fileActionsStr = this.config.getFileConfig(type as FileConfigType);
    if (fileActionsStr) {
      try {
        const parsed = JSON.parse(fileActionsStr);
        if (this.isWritingActionArray(parsed)) {
          actionsWithoutId = { default: parsed };
        } else {
          window.showErrorMessage(
            `Invalid ${type}.json format. Please check the file structure.`,
          );
        }
      } catch {
        window.showErrorMessage(
          `Failed to parse ${type}.json. Please ensure it is valid JSON.`,
        );
      }
    }

    const actionsCfg =
      actionsWithoutId ??
      this.config.getConfiguration<Omit<WritingAction, 'id'>[]>(
        type as string,
        [],
      );

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
