import { commands, ExtensionContext, languages, Range, TextDocument } from 'vscode';
import { ExtensionConfig } from './config/ExtensionConfig';
import { AIServiceFactory } from './services/AIServiceFactory';
import { WriteAssistAI } from './WriteAssistAI';
import { ACCEPT_REPHRASE_CMD, OPEN_AI_API_KEY_CMD, REJECT_REPHRASE_CMD } from './constants';

export class ExtensionManager {
  private config: ExtensionConfig;
  private aiServiceFactory: AIServiceFactory;

  constructor(private context: ExtensionContext) {
    this.config = new ExtensionConfig(
      context,
      this.handleCommandsConfigChange.bind(this)
    );

    this.aiServiceFactory = new AIServiceFactory(this.config);
    this.registerCommandsAndActions();
  }

  private handleCommandsConfigChange() {
    // Dispose all the existing subscriptions
    while (this.context.subscriptions.length) {
      this.context.subscriptions.pop()?.dispose();
    }

    // Re-register commands and actions
    this.registerCommandsAndActions();
  }

  private registerCodeActionsProviderAndCmds(actionsProvider: WriteAssistAI, supportedLanguages: string[], supportedCommands: string[]) {
    // Register the code action provider for supported languages
    const provider = languages.registerCodeActionsProvider(
      supportedLanguages,
      actionsProvider,
      {
        providedCodeActionKinds: WriteAssistAI.providedCodeActionKinds,
      }
    );

    this.context.subscriptions.push(provider);

    // Register all the commands for the code actions
    for (const command of supportedCommands) {
      this.context.subscriptions.push(
        commands.registerCommand(command, (...args: [string, TextDocument, Range]) => {
          actionsProvider.handleAction(...args);
        })
      );
    }
  }

  private registerCodeLensProviderAndCmds(codelensProvider: WriteAssistAI, supportedLanguages: string[], supportedCommands: string[]) {
    // Register the code lens provider for supported languages
    const provider = languages.registerCodeLensProvider(
      supportedLanguages,
      codelensProvider
    );

    this.context.subscriptions.push(provider);

    // Register the commands for accept/reject buttons
    this.context.subscriptions.push(
      commands.registerCommand(ACCEPT_REPHRASE_CMD,
        () => {
          codelensProvider.acceptRephrase();
        }
      )
    );

    this.context.subscriptions.push(
      commands.registerCommand(REJECT_REPHRASE_CMD,
        () => {
          codelensProvider.rejectRephrase();
        }
      )
    );
  }

  private registerCommandsAndActions() {
    const writeAssist: WriteAssistAI = new WriteAssistAI(
      this.config,
      this.aiServiceFactory
    );

    const supportedLanguages = [
      'markdown',
      "markdown_latex_combined",
      "markdown-math",
      "mdx",
      'plaintext',
      'tex',
      'latex',
      'bibtex',
      'quarto',
    ];

    this.registerCodeActionsProviderAndCmds(writeAssist, supportedLanguages, writeAssist.commands);

    this.registerCodeLensProviderAndCmds(writeAssist, supportedLanguages, writeAssist.commands);

    // Add the command for OpenAI API Key configuration
    this.context.subscriptions.push(
      commands.registerCommand(OPEN_AI_API_KEY_CMD, () =>
        this.config.promptUserForApiKey()
      )
    );
  }
}
