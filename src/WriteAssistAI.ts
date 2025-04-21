import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Position,
  Range,
  TextDocument,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
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

  getEditorIfValid(document: TextDocument) {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== document.uri.toString()) {
      return;
    }

    return editor;
  }

  async insertText(document: TextDocument, location: Position, text: string) {
    const separator = this.config.getSeparator();
    let textWithSeparator = ['\n', text];
    if (separator) {
      textWithSeparator.splice(1, 0, separator);
      textWithSeparator.push(separator, '');
    }

    const edit = new WorkspaceEdit();
    edit.insert(Uri.parse(document.uri.toString()), location, textWithSeparator.join('\n'));

    const response = await workspace.applyEdit(edit);
    if (response) {
      const lines = text.split('\n');
      // We're inserting the text 3 lines below the location if separator exists, else 2 lines
      const startLine = location.line + (separator ? 3 : 2);
      const endLine = startLine + lines.length - 1;

      return new Range(new Position(startLine, 0), new Position(endLine, lines[lines.length - 1].length));
    }
  }

  async replaceText(document: TextDocument, range: Range, text: string) {
    const edit = new WorkspaceEdit();
    edit.replace(Uri.parse(document.uri.toString()), range, text);

    return await workspace.applyEdit(edit);
  }

  async handleAction(prompt: string, document: TextDocument, range: Range) {
    this.currentlyProcessing = true;
    let openAIService;
    try {
      openAIService = await this.aiServiceFactory.getService();
    } catch (error) {
      await this.insertText(
        document,
        range.end,
        'Error: No API Key entered in the config input box above.\nPlease retry the selection and set the key.'
      );

      this.currentlyProcessing = false;

      return;
    }

    let newRange: Range | undefined;
    let message = '';

    try {
      newRange = await this.insertText(document, range.end, 'Thinking...');

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

    if (newRange) {
      await this.replaceText(document, newRange, message);
    }

    this.currentlyProcessing = false;
  }
}
