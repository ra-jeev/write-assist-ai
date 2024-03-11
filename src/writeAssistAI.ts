import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Range,
  Selection,
  TextDocument,
  window,
} from 'vscode';

import { OpenAiService } from './services/OpenAiService';
import { ExtensionConfig } from './ExtensionConfig';

type WritingAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
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

  private openAiSvc: OpenAiService | undefined;
  private allCommands: string[] = [];
  private actions: CodeAction[] = [];
  private currRange: Range | undefined;
  private extensionConfig: ExtensionConfig;

  constructor(config: ExtensionConfig) {
    this.extensionConfig = config;
    this.prepareCommandsAndActions();
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
      command: `${ExtensionConfig.sectionKey}.${writingAction.id}`,
      title: writingAction.title,
      tooltip: writingAction.description,
      arguments: [writingAction.prompt],
    };

    return action;
  }

  async createOpenApiSvc(): Promise<OpenAiService | undefined> {
    if (this.openAiSvc) {
      return this.openAiSvc;
    }

    let apiKey = await this.extensionConfig.getOpenAiApiKey();
    if (!apiKey) {
      apiKey = await this.extensionConfig.promptUserForApiKey();

      if (!apiKey) {
        return;
      }
    }

    const { maxTokens } = this.extensionConfig.getOpenAIConfig();

    return new OpenAiService(apiKey, maxTokens);
  }

  getOutputString(input: string): string {
    return `\n\n${'-'.repeat(32)}\n${input}\n\n${'-'.repeat(32)}\n`;
  }

  async handleAction(prompt: string) {
    const editor = window.activeTextEditor;
    if (!this.currRange || !editor) {
      return;
    }

    const currRangeEnd = this.currRange.end;
    const openAiSvc = await this.createOpenApiSvc();
    if (!openAiSvc) {
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          currRangeEnd,
          this.getOutputString(
            'Error: No API Key entered in the config input box above.\nPlease retry the selection and set the key.'
          )
        );
      });

      return;
    }

    let selectionStart = editor.selection.start;
    let selectionEnd = editor.selection.end;

    try {
      const fillerText = '\n\nThinking...';

      const fillerRes = await editor.edit((editBuilder) => {
        editBuilder.insert(currRangeEnd, fillerText);
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

      const text = editor.document.getText(this.currRange);
      const subPrompt = `If the text contains any special syntax then strictly follow the same syntax, e.g. for markdown return markdown, for latex return latex etc. Do not return markdown for latex, and vice versa. Here is the text`;

      const finalPrompt = `${prompt}. ${subPrompt}:\n\n${text}`;

      const response = await openAiSvc.createCompletion(finalPrompt);
      const replaceRes = await editor.edit((editBuilder) => {
        editBuilder.replace(new Range(selectionStart, selectionEnd), response);
      });

      if (replaceRes) {
        editor.selection = new Selection(
          selectionStart.line,
          selectionStart.character,
          selectionEnd.line,
          editor.document.lineAt(selectionEnd.line).text.length
        );
      }
    } catch (error) {
      editor.edit((editBuilder) => {
        editor.selection = new Selection(selectionStart, selectionEnd);
        editBuilder.replace(
          editor.selection,
          `${(error as any).message ?? 'Error: Failed to process'}`
        );
      });
    }
  }
}
