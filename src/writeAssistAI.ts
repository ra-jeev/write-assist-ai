import { OpenAIApi, Configuration } from 'openai';
import * as vscode from 'vscode';

type WritingAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export class WriteAssistAI implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.RefactorRewrite,
    vscode.CodeActionKind.QuickFix,
  ];

  public static readonly toneOptions: string[] = [
    'professional',
    'casual',
    'formal',
    'friendly',
    'informative',
    'authoritative',
  ];

  public static readonly quickFixActions = [
    {
      id: 'rephrase',
      title: 'Rephrase the selected text',
      description: 'Rephrases the selected text',
      prompt:
        'Rephrase the following text and make the sentences more clear and readable',
    },
    {
      id: 'suggest-titles',
      title: 'Suggest headlines for selection',
      description: 'Suggests some appropriate titles for the selected text',
      prompt: 'Suggest some short headlines for the following text',
    },
    {
      id: 'summarize',
      title: 'Summarize the selected text',
      description: 'Write a summary for the selected text',
      prompt: 'Write a short summary for the following text',
    },
    {
      id: 'expand',
      title: 'Expand the selected text',
      description: 'Builds upon the selected text and makes it verbose',
      prompt:
        'Continue building on the following text, make it better and verbose',
    },
    {
      id: 'shorten',
      title: 'Shorten the selected text',
      description: 'Based on the selected text tries to make it concise',
      prompt:
        'Based on the following text, try to make it readable and concise at the same time',
    },
  ];

  public static readonly extensionConfigKey = 'writeAssistAi';

  private openAiSvc: OpenAIApi | undefined;
  private allCommands: string[] = [];
  private actions: vscode.CodeAction[] = [];
  private currRange: vscode.Range | undefined;

  constructor() {
    this.openAiSvc = this.createOpenApiSvc();
    this.prepareCommandsAndActions();
  }

  getConfiguration<T>(key: string) {
    return vscode.workspace
      .getConfiguration(WriteAssistAI.extensionConfigKey)
      .get<T>(key);
  }

  prepareActionKind(
    writingActions: WritingAction[],
    actionKind: vscode.CodeActionKind
  ) {
    for (const writingAction of writingActions) {
      const action = this.createAction(writingAction, actionKind);
      this.actions.push(action);
      if (action.command) {
        this.allCommands.push(action.command.command);
      }
    }
  }

  prepareCommandsAndActions() {
    const toneChangeActions = [];
    for (const tone of WriteAssistAI.toneOptions) {
      toneChangeActions.push({
        id: tone,
        title: `Rewrite in ${tone} tone`,
        description: `Changes the selected text's tone to ${tone}`,
        prompt: `Make the following text better and rewrite it in a ${tone} tone`,
      });
    }

    this.prepareActionKind(
      toneChangeActions,
      vscode.CodeActionKind.RefactorRewrite
    );

    this.prepareActionKind(
      WriteAssistAI.quickFixActions,
      vscode.CodeActionKind.QuickFix
    );
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] | undefined {
    // If nothing is selected then we won't provide any action
    if (range.isEmpty) {
      this.currRange = undefined;
      return;
    }

    this.currRange = range;

    return this.actions;
  }

  get commands(): string[] {
    return this.allCommands;
  }

  createAction(
    writingAction: WritingAction,
    actionKind: vscode.CodeActionKind
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(writingAction.title, actionKind);
    action.command = {
      command: `${WriteAssistAI.extensionConfigKey}.${writingAction.id}`,
      title: writingAction.title,
      tooltip: writingAction.description,
      arguments: [writingAction.prompt],
    };

    return action;
  }

  createOpenApiSvc(severity: string = 'info'): OpenAIApi | undefined {
    if (this.openAiSvc) {
      return this.openAiSvc;
    }

    const apiKey = this.getConfiguration<string>('openAiApiKey');
    if (!apiKey) {
      const message =
        'Missing OpenAI API Key. Please add your key in VSCode settings to use this extension.';
      if (severity === 'error') {
        vscode.window.showErrorMessage(message);
      } else {
        vscode.window.showInformationMessage(message);
      }

      return;
    }

    return new OpenAIApi(
      new Configuration({
        apiKey,
      })
    );
  }

  async handleAction(prompt: string) {
    const editor = vscode.window.activeTextEditor;
    const openAiSvc = this.createOpenApiSvc('error');

    if (!openAiSvc || !this.currRange || !editor) {
      return;
    }

    let currRange = this.currRange;
    let selectionStart: vscode.Position;
    let selectionEnd: vscode.Position;

    try {
      const maxTokens = this.getConfiguration<number>('maxTokens');
      const fillerText = '\n\nThinking...';
      editor
        .edit((editBuilder) => {
          editBuilder.insert(currRange.end, fillerText);
        })
        .then((success) => {
          if (success) {
            editor.selection = new vscode.Selection(
              editor.selection.end.line,
              0,
              editor.selection.end.line,
              editor.selection.end.character
            );

            selectionStart = editor.selection.start;
            selectionEnd = editor.selection.end;
          }
        });

      const text = editor.document.getText(currRange);
      /* eslint-disable @typescript-eslint/naming-convention */
      const response = await openAiSvc.createCompletion({
        model: 'text-davinci-003',
        prompt: `${prompt}:\n\n${text}\n\n`,
        temperature: 0.3,
        max_tokens: maxTokens,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        n: 1,
      });
      /* eslint-enable @typescript-eslint/naming-convention */

      let result = response.data.choices[0].text;
      editor
        .edit((editBuilder) => {
          if (result) {
            editBuilder.replace(
              new vscode.Range(selectionStart, selectionEnd),
              result.trim()
            );
          }
        })
        .then((success) => {
          if (success) {
            editor.selection = new vscode.Selection(
              selectionStart.line,
              selectionStart.character,
              selectionEnd.line,
              editor.document.lineAt(selectionEnd.line).text.length
            );

            return;
          }
        });
    } catch (error) {
      console.error(error);
    }

    editor.edit((editBuilder) => {
      editor.selection = new vscode.Selection(selectionStart, selectionEnd);
      editBuilder.replace(editor.selection, 'Failed to process...');
    });
  }
}
