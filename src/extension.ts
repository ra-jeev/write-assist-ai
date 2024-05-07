import { commands, ExtensionContext, languages } from 'vscode';
import { WriteAssistAI } from './writeAssistAI';
import { ExtensionConfig } from './ExtensionConfig';

const handleCommandsConfigChange = (
  context: ExtensionContext,
  config: ExtensionConfig
) => {
  // Dispose all the existing subscriptions
  while (context.subscriptions.length) {
    context.subscriptions.pop()?.dispose();
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
      commands.registerCommand(command, (args) => {
        writeAssist.handleAction(args);
      })
    );
  }

  // Add the command for OpenAI API Key configuration
  context.subscriptions.push(
    commands.registerCommand(ExtensionConfig.openAiApiKeyCmd, () =>
      config.promptUserForApiKey()
    )
  );
};

export function activate(context: ExtensionContext) {
  registerCommandsAndActions(
    context,
    new ExtensionConfig(context, handleCommandsConfigChange)
  );
}

export function deactivate() {}
