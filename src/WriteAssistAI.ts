import {
  CancellationToken,
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  CodeLens,
  CodeLensProvider,
  DecorationRenderOptions,
  EventEmitter,
  Position,
  Progress,
  ProgressLocation,
  Range,
  Selection,
  TextDocument,
  TextEditor,
  TextEditorDecorationType,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
} from 'vscode';

import { AIServiceFactory } from './services/AIServiceFactory';
import { TokenLimitError } from './services/OpenAIService';
import { ExtensionConfig } from './config/ExtensionConfig';
import {
  ACCEPT_REPHRASE_CMD,
  CONFIG_SECTION_KEY,
  REJECT_REPHRASE_CMD,
} from './constants';
import type { LanguageConfig, WritingAction } from './types';

type DecorationWithRange = {
  range: Range;
  decoration: TextEditorDecorationType;
};

type RephraseTask = {
  document: TextDocument;
  original?: DecorationWithRange;
  rephrased?: DecorationWithRange;
};

const InfoMessages = {
  AI_SERVICE_ERROR: 'Error initializing AI service.',
  REPHRASE_ERROR: 'Error generating rephrased text.',
  REPHRASE_ACCEPT_ERROR: 'Error accepting rephrased text.',
  REPHRASE_REJECT_ERROR: 'Error rejecting rephrased text.',
  GENERATING_REPHRASE: 'Generating rephrased text...',
  REPHRASE_CANCELLED: 'Rephrase task cancelled!',
};

export class WriteAssistAI implements CodeActionProvider, CodeLensProvider {
  activeRephrase: RephraseTask | null = null;

  private codeLensEventEmitter = new EventEmitter<void>();
  public onDidChangeCodeLenses = this.codeLensEventEmitter.event;

  public static readonly providedCodeActionKinds = [
    CodeActionKind.RefactorRewrite,
    CodeActionKind.QuickFix,
  ];

  private allCommands: string[] = [];
  private actions: LanguageConfig<CodeAction[]> = { default: [] };
  private currentlyProcessing = false;

  constructor(
    private readonly config: ExtensionConfig,
    private readonly aiServiceFactory: AIServiceFactory,
  ) {
    this.prepareActionsFromConfig();
  }

  get commands(): string[] {
    return this.allCommands;
  }

  prepareActionsFromConfig() {
    const actionsFromConfig = this.config.getActions();

    this.prepareActionKind(
      actionsFromConfig.rewriteOptions,
      CodeActionKind.RefactorRewrite,
    );

    this.prepareActionKind(
      actionsFromConfig.quickFixes,
      CodeActionKind.QuickFix,
    );
  }

  prepareActionKind(
    writingActions: LanguageConfig<WritingAction[]>,
    actionKind: CodeActionKind,
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
    actionKind: CodeActionKind,
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
    range: Range,
  ): CodeAction[] | undefined {
    const actions = this.actions[document.languageId] ?? this.actions.default;

    actions.forEach((action) => {
      if (action.command?.arguments?.length) {
        action.command.arguments = [
          action.command.arguments[0],
          document,
          range,
        ];
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

  async insertText(
    document: TextDocument,
    location: Position,
    text: string,
    addSeparator = true,
  ) {
    let textWithSeparator = ['', text];
    let newLinesAdded = 1;

    if (addSeparator) {
      const separator = this.config.getSeparator();
      if (separator) {
        textWithSeparator.splice(1, 0, separator);
        textWithSeparator.push(separator);
        newLinesAdded++;
      } else {
        textWithSeparator[0] = '\n';
        newLinesAdded++;

        textWithSeparator.push(''); // To add an empty line at the end
      }
    }

    const edit = new WorkspaceEdit();
    edit.insert(
      Uri.parse(document.uri.toString()),
      location,
      textWithSeparator.join('\n'),
    );

    const response = await workspace.applyEdit(edit);
    if (response) {
      const lines = text.split('\n');

      const startLine = location.line + newLinesAdded;
      const endLine = startLine + lines.length - 1;

      return new Range(
        new Position(startLine, 0),
        new Position(endLine, lines[lines.length - 1].length),
      );
    }
  }

  async replaceText(document: TextDocument, range: Range, text: string) {
    const edit = new WorkspaceEdit();
    edit.replace(Uri.parse(document.uri.toString()), range, text);

    return await workspace.applyEdit(edit);
  }

  async deleteRange(document: TextDocument, range: Range) {
    const edit = new WorkspaceEdit();
    edit.delete(Uri.parse(document.uri.toString()), range);

    return await workspace.applyEdit(edit);
  }

  applyDecorations(
    editor: TextEditor,
    decorations: {
      type: 'original' | 'rephrased';
      range: Range;
      decorationOptions: DecorationRenderOptions;
    }[],
  ) {
    this.activeRephrase = {
      document: editor.document,
    };

    for (const { type, range, decorationOptions } of decorations) {
      const decorationType =
        window.createTextEditorDecorationType(decorationOptions);
      this.activeRephrase[type] = {
        range,
        decoration: decorationType,
      };

      editor.setDecorations(decorationType, [range]);
    }
  }

  private async getAIService() {
    try {
      return await this.aiServiceFactory.getService();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : InfoMessages.AI_SERVICE_ERROR;
      throw new Error(errorMessage);
    }
  }

  private async handleServiceError(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : InfoMessages.AI_SERVICE_ERROR;
    await window.showErrorMessage(errorMessage);
  }

  async handleAction(prompt: string, document: TextDocument, range: Range) {
    this.currentlyProcessing = true;
  
    try {
      const openAIService = await this.getAIService();
    
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: InfoMessages.GENERATING_REPHRASE,
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            window.showInformationMessage(InfoMessages.REPHRASE_CANCELLED);
          });
  
          progress.report({ increment: 30 });
    
          await this.processRephrase(openAIService, prompt, document, range, progress, token, false);
        },
      );
    } catch (error) {
      await this.handleServiceError(error);
    } finally {
      this.currentlyProcessing = false;
    }
  }

  private async processRephrase(
    openAIService: any,
    prompt: string,
    document: TextDocument,
    range: Range,
    progress: Progress<{ message?: string; increment?: number }>,
    token: CancellationToken,
    ignoreMaxTokens: boolean
  ) {
    try {
      const rephrasedText = await this.generateRephrasedText(
        openAIService,
        prompt,
        document,
        range,
        ignoreMaxTokens
      );

      if (token.isCancellationRequested) {
        return;
      }

      progress.report({ increment: 70 });
      await this.handleRephraseResult(document, range, rephrasedText);
    } catch (error) {
      if (token.isCancellationRequested) {
        return;
      }

      if (error instanceof TokenLimitError && !ignoreMaxTokens) {
        const shouldRetry = await this.promptForRetryWithoutLimit(error, progress);
      
        if (shouldRetry && !token.isCancellationRequested) {
          await this.processRephrase(
            openAIService,
            prompt,
            document,
            range,
            progress,
            token,
            true
          );
        }  
      } else {
        await this.handleGeneralError(error);
      }
    }
  }

  private async promptForRetryWithoutLimit(
    error: TokenLimitError,
    progress: Progress<{ message?: string; increment?: number }>
  ): Promise<boolean> {
    const retryChoice = await window.showWarningMessage(
      error.message,
      { modal: true },
      'Retry without limit',
    );
  
    if (retryChoice === 'Retry without limit') {
      progress.report({
        increment: 10,
        message: 'Retrying without token limit...',
      });

      return true;
    }
  
    await this.cleanupRephrase();
    return false;
  }

  private async generateRephrasedText(
    openAIService: any,
    prompt: string,
    document: TextDocument,
    range: Range,
    ignoreMaxTokens: boolean
  ): Promise<string> {
    const originalText = document.getText(range);
    return await openAIService.createChatCompletion(
      prompt,
      originalText,
      document.languageId,
      { ignoreMaxTokens }
    );
  }

  private async handleRephraseResult(
    document: TextDocument,
    range: Range,
    rephrasedText: string
  ) {
    const useAcceptRejectFlow = this.config.getUseAcceptRejectFlow();
    const editor = this.getEditorIfValid(document);
  
    if (editor && useAcceptRejectFlow) {
      await this.handleAcceptRejectFlow(editor, document, range, rephrasedText);
    } else {
      await this.insertText(document, range.end, rephrasedText);
    }
  }

  private async handleAcceptRejectFlow(
    editor: TextEditor,
    document: TextDocument,
    originalRange: Range,
    rephrasedText: string
  ) {
    editor.selection = new Selection(originalRange.end, originalRange.end);

    const rephrasedRange = await this.insertText(
      document,
      originalRange.end,
      rephrasedText,
      false,
    );
  
    if (rephrasedRange) {
      this.applyDecorations(editor, [
        this.createDecoration('original', originalRange),
        this.createDecoration('rephrased', rephrasedRange),
      ]);

      // Trigger codelens refresh to show buttons
      this.codeLensEventEmitter.fire();
    }
  }

  private createDecoration(
    type: 'original' | 'rephrased',
    range: Range,
  ) {
    return {
      type,
      range,
      decorationOptions: (type === 'original' ? {
        backgroundColor: 'rgba(255, 182, 193, 0.2)',
        border: '1px solid red',
        isWholeLine: true,
      } : {
        backgroundColor: 'rgba(144, 255, 144, 0.2)',
        border: '1px solid green',
        isWholeLine: true,
      }),
    };
  }

  private async handleGeneralError(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : InfoMessages.REPHRASE_ERROR;
    await window.showErrorMessage(errorMessage);
    await this.cleanupRephrase();
  }

  provideCodeLenses(document: TextDocument): CodeLens[] {
    const codeLenses: CodeLens[] = [];

    if (
      !this.activeRephrase ||
      this.activeRephrase.document.uri.toString() !== document.uri.toString() ||
      !this.activeRephrase.original ||
      !this.activeRephrase.rephrased
    ) {
      return codeLenses;
    }

    const lensRange = new Range(
      this.activeRephrase.rephrased.range.end.line + 1,
      0,
      this.activeRephrase.rephrased.range.end.line + 1,
      0,
    );

    codeLenses.push(
      new CodeLens(lensRange, {
        title: '$(check) Accept',
        command: ACCEPT_REPHRASE_CMD,
        arguments: [],
      }),
    );

    codeLenses.push(
      new CodeLens(lensRange, {
        title: '$(x) Reject',
        command: REJECT_REPHRASE_CMD,
        arguments: [],
      }),
    );

    return codeLenses;
  }

  async deleteRephrase(document: TextDocument, rephrasedRange: Range) {
    const deleteRange = new Range(
      rephrasedRange.start.line,
      rephrasedRange.start.character,
      rephrasedRange.end.line + 1,
      0,
    );

    await this.deleteRange(document, deleteRange);
  }

  async acceptRephrase() {
    if (
      !this.activeRephrase ||
      !this.activeRephrase.original ||
      !this.activeRephrase.rephrased
    ) {
      return;
    }

    try {
      const rephrasedText = this.activeRephrase.document.getText(
        this.activeRephrase.rephrased.range,
      );

      await this.replaceText(
        this.activeRephrase.document,
        this.activeRephrase.original.range,
        rephrasedText,
      );

      this.deleteRephrase(
        this.activeRephrase.document,
        this.activeRephrase.rephrased.range,
      );
    } catch (error) {
      let errorMessage = InfoMessages.REPHRASE_ACCEPT_ERROR;
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      window.showErrorMessage(errorMessage);
    }

    await this.cleanupRephrase();
  }

  async rejectRephrase() {
    if (
      !this.activeRephrase ||
      !this.activeRephrase.original ||
      !this.activeRephrase.rephrased
    ) {
      return;
    }

    try {
      await this.deleteRephrase(
        this.activeRephrase.document,
        this.activeRephrase.rephrased.range,
      );
    } catch (error) {
      let errorMessage = InfoMessages.REPHRASE_REJECT_ERROR;
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      window.showErrorMessage(errorMessage);
    }

    await this.cleanupRephrase();
  }

  private async cleanupRephrase() {
    if (
      !this.activeRephrase ||
      !this.activeRephrase.original ||
      !this.activeRephrase.rephrased
    ) {
      return;
    }

    this.activeRephrase.original.decoration.dispose();
    this.activeRephrase.rephrased.decoration.dispose();

    this.activeRephrase = null;

    this.codeLensEventEmitter.fire();
  }
}
