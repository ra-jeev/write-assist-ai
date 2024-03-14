import { commands, ExtensionContext, languages } from 'vscode';
import { WriteAssistAI } from './writeAssistAI';
import { ExtensionConfig } from './ExtensionConfig';

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

export function deactivate() {}
