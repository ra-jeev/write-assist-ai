// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WriteAssistAI } from './writeAssistAI';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const writeAssist: WriteAssistAI = new WriteAssistAI();
  const aiActionProvider = vscode.languages.registerCodeActionsProvider(
    'markdown',
    writeAssist,
    {
      providedCodeActionKinds: WriteAssistAI.providedCodeActionKinds,
    }
  );

  context.subscriptions.push(aiActionProvider);
  for (const command of writeAssist.commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, () =>
        writeAssist.handleAction(command)
      )
    );
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
