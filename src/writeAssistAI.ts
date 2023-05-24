import { OpenAIApi, Configuration } from 'openai';
import * as vscode from 'vscode';

export class WriteAssistAI implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.RefactorRewrite,
  ];

  public static readonly writingStyles = [
    'professional',
    'formal',
    'casual',
    'friendly',
    'informative',
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

  prepareCommandsAndActions() {
    for (const writingStyle of WriteAssistAI.writingStyles) {
      const action = this.createAction(writingStyle);
      this.actions.push(action);
      this.allCommands.push(
        `${WriteAssistAI.extensionConfigKey}.${writingStyle}`
      );
    }
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

  createAction(writingStyle: string): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `in ${writingStyle} tone`,
      vscode.CodeActionKind.RefactorRewrite
    );

    action.command = {
      command: `${WriteAssistAI.extensionConfigKey}.${writingStyle}`,
      title: `Rephrase in ${writingStyle} tone`,
      tooltip: `This will change the text tone to ${writingStyle}.`,
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

  async handleAction(command: string) {
    const editor = vscode.window.activeTextEditor;
    const openAiSvc = this.createOpenApiSvc('error');

    if (!openAiSvc || !this.currRange || !editor) {
      return;
    }

    const writingStyle = command.split(
      `${WriteAssistAI.extensionConfigKey}.`
    )[1];
    let currRange = this.currRange;
    let selectionStart: vscode.Position;
    let selectionEnd: vscode.Position;

    try {
      const maxTokens = this.getConfiguration<number>('maxTokens');
      const fillerText = '\n\nRewriting, please wait...';
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
      const response = await openAiSvc.createCompletion({
        model: 'text-davinci-003',
        prompt: `Rewrite the following text in a ${writingStyle} tone.\n\n${text}\n\n`,
        temperature: 0.3,
        max_tokens: maxTokens,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        n: 1,
      });

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
      editBuilder.replace(editor.selection, 'Failed to rewrite...');
    });
  }
}
