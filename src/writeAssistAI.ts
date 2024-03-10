import { OpenAI, APIError } from 'openai';
import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Range,
  SecretStorage,
  Selection,
  TextDocument,
  window,
  workspace,
} from 'vscode';

type WritingAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

type ExtensionConfig = {
  apiKey?: string;
  maxTokens: number;
};

export class WriteAssistAI implements CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    CodeActionKind.RefactorRewrite,
    CodeActionKind.QuickFix,
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

  private openAiSvc: OpenAI | undefined;
  private allCommands: string[] = [];
  private actions: CodeAction[] = [];
  private currRange: Range | undefined;
  private secrets: SecretStorage;
  private config: ExtensionConfig | undefined;

  constructor(secrets: SecretStorage) {
    this.secrets = secrets;
    this.readExtensionConfig();
    this.prepareCommandsAndActions();
  }

  getConfiguration<T>(key: string) {
    return workspace
      .getConfiguration(WriteAssistAI.extensionConfigKey)
      .get<T>(key);
  }

  async updateConfiguration(key: string, value: any) {
    try {
      // Update in global settings
      await workspace
        .getConfiguration(WriteAssistAI.extensionConfigKey)
        .update(key, value, true);
    } catch (error) {
      console.error(`No global configuration for ${key}`, error);
    }

    try {
      // Update in workspace settings
      await workspace
        .getConfiguration(WriteAssistAI.extensionConfigKey)
        .update(key, value);
    } catch (error) {
      console.error(`No workspace configuration for ${key}`, error);
    }
  }

  prepareActionKind(
    writingActions: WritingAction[],
    actionKind: CodeActionKind
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

    this.prepareActionKind(toneChangeActions, CodeActionKind.RefactorRewrite);

    this.prepareActionKind(
      WriteAssistAI.quickFixActions,
      CodeActionKind.QuickFix
    );
  }

  provideCodeActions(
    document: TextDocument,
    range: Range
  ): CodeAction[] | undefined {
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
    actionKind: CodeActionKind
  ): CodeAction {
    const action = new CodeAction(writingAction.title, actionKind);
    action.command = {
      command: `${WriteAssistAI.extensionConfigKey}.${writingAction.id}`,
      title: writingAction.title,
      tooltip: writingAction.description,
      arguments: [writingAction.prompt],
    };

    return action;
  }

  async readFromSettingsAndMigrate(): Promise<{
    apiKey: string;
    maxTokens: number;
  } | null> {
    const apiKey = this.getConfiguration<string>('openAiApiKey');
    if (apiKey) {
      // Store the key in the secretStorage
      await this.secrets.store('openAi.apiKey', apiKey);
      // Delete the key from the settings
      await this.updateConfiguration('openAiApiKey', undefined);

      let maxTokens = this.getConfiguration<number>('maxTokens');
      if (maxTokens) {
        // Remove the old key from the settings
        await this.updateConfiguration('maxTokens', undefined);
        // Update the new key with the existing value
        await this.updateConfiguration('openAi.maxTokens', maxTokens);
      } else {
        maxTokens = this.getConfiguration<number>('openAi.maxTokens') ?? 900;
      }

      return {
        apiKey,
        maxTokens,
      };
    }

    return null;
  }

  async readExtensionConfig() {
    const existingConfig = await this.readFromSettingsAndMigrate();
    if (existingConfig) {
      this.config = {
        apiKey: existingConfig.apiKey,
        maxTokens: existingConfig.maxTokens,
      };

      return;
    }

    const apiKey = await this.secrets.get('openAi.apiKey');
    const maxTokens = this.getConfiguration<number>('openAi.maxTokens') ?? 900;

    this.config = {
      apiKey,
      maxTokens,
    };
  }

  createOpenApiSvc(): OpenAI | undefined {
    if (this.openAiSvc) {
      return this.openAiSvc;
    }

    const apiKey = this.config?.apiKey;
    if (!apiKey) {
      window.showErrorMessage(
        'No API key found, please set one in the settings'
      );

      return;
    }

    return new OpenAI({
      apiKey,
    });
  }

  async handleAction(prompt: string) {
    const editor = window.activeTextEditor;
    const openAiSvc = this.createOpenApiSvc();

    if (!openAiSvc || !this.currRange || !editor || !this.config) {
      return;
    }

    let currRange = this.currRange;
    let selectionStart = editor.selection.start;
    let selectionEnd = editor.selection.end;

    try {
      const maxTokens = this.config.maxTokens;
      const fillerText = '\n\nThinking...';

      const fillerRes = await editor.edit((editBuilder) => {
        editBuilder.insert(currRange.end, fillerText);
      });

      if (fillerRes) {
        editor.selection = new Selection(
          editor.selection.end.line,
          0,
          editor.selection.end.line,
          editor.selection.end.character
        );

        selectionStart = editor.selection.start;
        selectionEnd = editor.selection.end;
      }

      const text = editor.document.getText(currRange);
      const subPrompt = `If the text contains any special syntax then strictly follow the same syntax, e.g. for markdown return markdown, for latex return latex etc. Do not return markdown for latex, and vice versa. Here is the text`;
      /* eslint-disable @typescript-eslint/naming-convention */
      const response = await openAiSvc.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: `${prompt}. ${subPrompt}:\n\n${text}`,
        temperature: 0.3,
        max_tokens: maxTokens,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
        n: 1,
      });
      /* eslint-enable @typescript-eslint/naming-convention */

      if (response.choices.length) {
        const result = response.choices[0].text.trim();
        const replaceRes = await editor.edit((editBuilder) => {
          editBuilder.replace(new Range(selectionStart, selectionEnd), result);
        });

        if (replaceRes) {
          editor.selection = new Selection(
            selectionStart.line,
            selectionStart.character,
            selectionEnd.line,
            editor.document.lineAt(selectionEnd.line).text.length
          );
        }
      }
    } catch (error) {
      let errMessage = '';
      if (error instanceof APIError) {
        errMessage = `Error: ${error.code}: ${error.message}`;
      } else {
        errMessage = `Error: ${(error as any).message ?? 'Failed to process'}`;
      }

      editor.edit((editBuilder) => {
        editor.selection = new Selection(selectionStart, selectionEnd);
        editBuilder.replace(editor.selection, errMessage);
      });
    }
  }
}
