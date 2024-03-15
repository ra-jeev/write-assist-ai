import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Position,
  Range,
  Selection,
  TextDocument,
  window,
} from 'vscode';

import { OpenAiService } from './services/OpenAiService';
import { ExtensionConfig, type WritingAction } from './ExtensionConfig';

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
  private currentlyProcessing = false;

  constructor(config: ExtensionConfig) {
    this.extensionConfig = config;
    this.prepareActionsFromConfig();
  }

  prepareActionsFromConfig() {
    const actionsFromConfig = this.extensionConfig.getActions();
    if (actionsFromConfig.rewriteActions.length) {
      this.prepareActionKind(
        actionsFromConfig.rewriteActions,
        CodeActionKind.RefactorRewrite
      );
    }

    if (actionsFromConfig.quickFixes) {
      this.prepareActionKind(
        actionsFromConfig.quickFixes,
        CodeActionKind.QuickFix
      );
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
    // If nothing is selected, or if already some processing is
    // under progress, then we won't provide any action
    if (range.isEmpty || this.currentlyProcessing) {
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

    this.openAiSvc = new OpenAiService(
      apiKey,
      this.extensionConfig.getOpenAIConfig()
    );

    return this.openAiSvc;
  }

  async insertText(location: Position, text: string) {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }

    const response = await editor.edit((editBuilder) => {
      editBuilder.insert(
        location,
        `\n\n${'*'.repeat(50)}\n${text}\n${'*'.repeat(50)}\n`
      );
    });

    if (response) {
      const lines = text.split('\n');
      const startingLineNo = location.line + 3; // We're adding the text 3 lines below
      const endingLineNo = startingLineNo + lines.length - 1;
      editor.selection = new Selection(
        startingLineNo,
        0,
        endingLineNo,
        lines[lines.length - 1].length
      );

      return editor.selection;
    }

    return;
  }

  async replaceText(location: Selection, text: string) {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }

    return await editor.edit((editBuilder) => {
      editBuilder.replace(location, text);
    });
  }

  async handleAction(prompt: string) {
    const editor = window.activeTextEditor;
    if (!this.currRange || !editor) {
      return;
    }

    this.currentlyProcessing = true;
    const currRangeEnd = this.currRange.end;
    const openAiSvc = await this.createOpenApiSvc();
    if (!openAiSvc) {
      await this.insertText(
        currRangeEnd,
        'Error: No API Key entered in the config input box above.\nPlease retry the selection and set the key.'
      );

      return;
    }

    let selection: Selection | undefined;
    let message = '';

    try {
      selection = await this.insertText(currRangeEnd, 'Thinking...');

      const text = editor.document.getText(this.currRange);
      // const subPrompt = `If the text contains any special syntax then strictly follow the same syntax, e.g. for markdown return markdown, for latex return latex etc. Do not return markdown for latex, and vice versa. Here is the text (may contain multiple newlines in between):`;
      // const finalPrompt = `${prompt}. ${subPrompt}:\n\n${text}`;

      // message = await openAiSvc.createCompletion(finalPrompt);
      message = await openAiSvc.createChatCompletion(prompt, text);
    } catch (error) {
      message = (error as any).message ?? 'Error: Failed to process';
    }

    if (selection) {
      await this.replaceText(selection, message);
    } else {
      await this.insertText(currRangeEnd, message);
    }

    this.currentlyProcessing = false;
    this.currRange = undefined;
  }
}
