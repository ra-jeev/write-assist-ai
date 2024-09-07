import { commands, ExtensionContext, languages } from 'vscode';
import { ExtensionConfig } from './config/ExtensionConfig';
import { AIServiceFactory } from './services/AIServiceFactory';
import { WriteAssistAI } from './WriteAssistAI';
import { OPEN_AI_API_KEY_CMD } from './constants';

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

  private registerCommandsAndActions() {
    const writeAssist: WriteAssistAI = new WriteAssistAI(
      this.config,
      this.aiServiceFactory
    );

    const aiActionProvider = languages.registerCodeActionsProvider(
      ['markdown', 'plaintext', 'tex', 'latex', 'bibtex'],
      writeAssist,
      {
        providedCodeActionKinds: WriteAssistAI.providedCodeActionKinds,
      }
    );

    this.context.subscriptions.push(aiActionProvider);
    for (const command of writeAssist.commands) {
      this.context.subscriptions.push(
        commands.registerCommand(command, (args) => {
          writeAssist.handleAction(args);
        })
      );
    }

    // Add the command for OpenAI API Key configuration
    this.context.subscriptions.push(
      commands.registerCommand(OPEN_AI_API_KEY_CMD, () =>
        this.config.promptUserForApiKey()
      )
    );
  }
}
