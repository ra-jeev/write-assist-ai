import { commands, ExtensionContext, languages } from 'vscode';
import { WriteAssistAI } from './writeAssistAI';
import { ExtensionConfig } from './ExtensionConfig';

const handleCommandsConfigChange = (
  context: ExtensionContext,
  config: ExtensionConfig
) => {
  // Dispose all the existing subscriptions
  for (const subscription of context.subscriptions) {
    subscription.dispose();
  }

  // Register commands and actions afresh
  registerCommandsAndActions(context, config);
};

const registerCommandsAndActions = (
  context: ExtensionContext,
  config: ExtensionConfig
) => {
  const writeAssist: WriteAssistAI = new WriteAssistAI(config);
  const aiActionProvider = languages.registerCodeActionsProvider(
    ['markdown', 'plaintext', 'tex', 'latex', 'bibtex'],
    writeAssist,
    {
      providedCodeActionKinds: WriteAssistAI.providedCodeActionKinds,
    }
  );

  context.subscriptions.push(aiActionProvider);
  for (const command of writeAssist.commands) {
    context.subscriptions.push(
      commands.registerCommand(command, (args) =>
        writeAssist.handleAction(args)
      )
    );
  }
};

export function activate(context: ExtensionContext) {
  registerCommandsAndActions(
    context,
    new ExtensionConfig(context, handleCommandsConfigChange)
  );
}

export function deactivate() {}
