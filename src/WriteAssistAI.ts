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

import { AIServiceFactory } from './services/AIServiceFactory';
import { ExtensionConfig } from './config/ExtensionConfig';
import { CONFIG_SECTION_KEY } from './constants';
import type { LanguageConfig, WritingAction } from './types';

export class WriteAssistAI implements CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    CodeActionKind.RefactorRewrite,
    CodeActionKind.QuickFix,
  ];

  private allCommands: string[] = [];
  private actions: LanguageConfig<CodeAction[]> = { default: [] };
  private currentlyProcessing = false;

  constructor(
    private readonly config: ExtensionConfig,
    private readonly aiServiceFactory: AIServiceFactory
  ) {
    this.prepareActionsFromConfig();
  }

  get commands(): string[] {
    return this.allCommands;
  }

  prepareActionsFromConfig() {
    const actionsFromConfig = this.config.getActions();

    this.prepareActionKind(
      actionsFromConfig.rewriteActions,
      CodeActionKind.RefactorRewrite
    );

    this.prepareActionKind(
      actionsFromConfig.quickFixes,
      CodeActionKind.QuickFix
    );
  }

  prepareActionKind(
    writingActions: LanguageConfig<WritingAction[]>,
    actionKind: CodeActionKind
  ) {
    for (const languageId in writingActions) {
      if (!(languageId in this.actions)) {
        this.actions[languageId] = [];
      }

      for (const writingAction of writingActions[languageId]) {
        const action = this.createAction(writingAction, actionKind);
        this.actions[languageId].push(action);
        if (action.command) {
          this.allCommands.push(action.command.command);
        }
      }
    }
  }

  createAction(
    writingAction: WritingAction,
    actionKind: CodeActionKind
  ): CodeAction {
    const action = new CodeAction(writingAction.title, actionKind);
    action.command = {
      command: `${CONFIG_SECTION_KEY}.${writingAction.id}`,
      title: writingAction.title,
      tooltip: writingAction.description,
      arguments: [writingAction.prompt],
    };

    return action;
  }

  provideCodeActions(
    document: TextDocument,
    range: Range
  ): CodeAction[] | undefined {
    // If nothing is selected, or if the previous action is
    // already under progress, then don't provide any action
    if (range.isEmpty || this.currentlyProcessing) {
      return;
    }

    const actions = this.actions[document.languageId] ?? this.actions.default;

    actions.forEach((action) => {
      if (action.command?.arguments?.length) {
        action.command.arguments = [action.command.arguments[0], document, range];
      }
    });

    return actions;
  }

  async insertText(location: Position, text: string) {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }

    const separator = this.config.getSeparator();
    const response = await editor.edit((editBuilder) => {
      editBuilder.insert(
        location,
        `\n\n${separator ? separator + '\n' : ''}${text}${separator ? '\n' + separator : ''}\n`
      );
    });

    if (response) {
      const lines = text.split('\n');
      const startingLineNo = location.line + (separator ? 3 : 2); // We're adding the text 3 lines below if separator, else 2 line
      const endingLineNo = startingLineNo + lines.length - 1;
      editor.selection = new Selection(
        startingLineNo,
        0,
        endingLineNo,
        lines[lines.length - 1].length
      );

      return editor.selection;
    }
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

  async handleAction(prompt: string, document: TextDocument, range: Range) {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
      return;
    }

    this.currentlyProcessing = true;
    const currRangeEnd = range.end;
    let openAIService;
    try {
      openAIService = await this.aiServiceFactory.getService();
    } catch (error) {
      await this.insertText(
        currRangeEnd,
        'Error: No API Key entered in the config input box above.\nPlease retry the selection and set the key.'
      );

      this.currentlyProcessing = false;

      return;
    }

    let selection: Selection | undefined;
    let message = '';

    try {
      selection = await this.insertText(currRangeEnd, 'Thinking...');

      const text = document.getText(range);
      message = await openAIService.createChatCompletion(
        prompt,
        text,
        document.languageId
      );
    } catch (error) {
      message = 'Error: Failed to process';
      if (error instanceof Error) {
        message = error.message;
      }
    }

    if (selection) {
      await this.replaceText(selection, message);
    } else {
      await this.insertText(currRangeEnd, message);
    }

    this.currentlyProcessing = false;
  }
}
