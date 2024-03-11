// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { commands, ExtensionContext, languages } from 'vscode';
import { WriteAssistAI } from './writeAssistAI';
import { ExtensionConfig } from './ExtensionConfig';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
  const config = new ExtensionConfig(context.secrets);
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
