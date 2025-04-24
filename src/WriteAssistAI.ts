import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  CodeLens,
  CodeLensProvider,
  EventEmitter,
  Position,
  ProgressLocation,
  Range,
  Selection,
  TextDocument,
  TextEditorDecorationType,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
} from 'vscode';

import { AIServiceFactory } from './services/AIServiceFactory';
import { ExtensionConfig } from './config/ExtensionConfig';
import { ACCEPT_REPHRASE_CMD, CONFIG_SECTION_KEY, REJECT_REPHRASE_CMD } from './constants';
import type { LanguageConfig, WritingAction } from './types';

export class WriteAssistAI implements CodeActionProvider, CodeLensProvider {
  private activeRephrase: {
    document: TextDocument,
    originalRange: Range,
    rephrasedRange: Range | null,
    originalDecoration: TextEditorDecorationType,
    rephrasedDecoration: TextEditorDecorationType | null
  } | null = null;

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

    // let newRange: Range | undefined;
    // let message = '';

    // try {
    //   newRange = await this.insertText(document, range.end, 'Thinking...');

    //   const text = document.getText(range);
    //   message = await openAIService.createChatCompletion(
    //     prompt,
    //     text,
    //     document.languageId
    //   );
    // } catch (error) {
    //   message = 'Error: Failed to process';
    //   if (error instanceof Error) {
    //     message = error.message;
    //   }
    // }

    // if (newRange) {
    //   await this.replaceText(document, newRange, message);
    // }
    const originalText = document.getText(range);

    // Create decoration for original text
    const originalDecoration = window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 182, 193, 0.2)',
      border: '1px solid red',
      isWholeLine: true,
    });

    let editor = this.getEditorIfValid(document);
    if (editor) {
      editor.selection = new Selection(range.end, range.end);
      // Apply the original decoration
      editor.setDecorations(originalDecoration, [range]);
    }

    // Store the active rephrase with partial data (no rephrased text yet)
    this.activeRephrase = {
      document,
      originalRange: range,
      rephrasedRange: null,
      originalDecoration,
      rephrasedDecoration: null
    };

    // Show loading indicator while getting rephrased text
    await window.withProgress({
      location: ProgressLocation.Notification,
      title: "Generating rephrased text...",
      cancellable: true
    }, async (progress, token) => {
      // Listen for cancellation
      token.onCancellationRequested(() => {
        this.cleanupRephrase();
        return;
      });

      progress.report({ increment: 30 });

      try {
        const rephrasedText = await openAIService.createChatCompletion(
          prompt,
          originalText,
          document.languageId
        );

        progress.report({ increment: 70 });

        // Make sure the document and editor are still valid
        editor = this.getEditorIfValid(document);
        if (!this.activeRephrase || !editor) {
          return;
        }

        // Insert the rephrased text with edits
        const edit = new WorkspaceEdit();
        edit.insert(document.uri, range.end, `\n\n${rephrasedText}\n`);
        await workspace.applyEdit(edit);

        // Calculate the range of the inserted text
        const startPos = new Position(range.end.line + 2, 0);
        const lines = rephrasedText.split('\n');
        const endLine = range.end.line + 2 + lines.length - 1;
        const endChar = lines[lines.length - 1].length;
        const endPos = new Position(endLine, endChar);
        const rephrasedRange = new Range(startPos, endPos);

        // Apply decoration to the rephrased text
        const rephrasedDecoration = window.createTextEditorDecorationType({
          backgroundColor: 'rgba(144, 255, 144, 0.2)',
          border: '1px solid green',
          isWholeLine: true,
        });

        editor.setDecorations(rephrasedDecoration, [rephrasedRange]);

        // Update the active rephrase with rephrased text info
        if (this.activeRephrase) {
          this.activeRephrase.rephrasedRange = rephrasedRange;
          this.activeRephrase.rephrasedDecoration = rephrasedDecoration;
        }

        // Trigger codelens refresh to show buttons
        this.codeLensEventEmitter.fire();
      } catch (error) {
        window.showErrorMessage(`Error generating rephrased text: ${error}`);
        await this.cleanupRephrase();
      }

      this.currentlyProcessing = false;
    });
  }

  provideCodeLenses(document: TextDocument): CodeLens[] {
    const codeLenses: CodeLens[] = [];

    // Only provide codelenses if there's an active rephrase for this document
    if (!this.activeRephrase ||
      this.activeRephrase.document.uri.toString() !== document.uri.toString() ||
      !this.activeRephrase.rephrasedRange) {
      return codeLenses;
    }

    // Create a range for the codelens (between original and rephrased)
    const lensRange = new Range(
      this.activeRephrase.originalRange.end.line + 1, 0,
      this.activeRephrase.originalRange.end.line + 1, 0
    );

    // Accept button
    codeLenses.push(new CodeLens(
      lensRange,
      {
        title: '$(check) Accept',
        command: ACCEPT_REPHRASE_CMD,
        arguments: []
      }
    ));

    // Reject button
    codeLenses.push(new CodeLens(
      lensRange,
      {
        title: '$(x) Reject',
        command: REJECT_REPHRASE_CMD,
        arguments: []
      }
    ));

    return codeLenses;
  }

  // Accept the rephrased text (keep it, delete original)
  async acceptRephrase() {
    if (!this.activeRephrase || !this.activeRephrase.rephrasedRange) {
      return;
    }

    try {
      // Get the rephrased text
      const document = this.activeRephrase.document;
      const rephrasedText = document.getText(this.activeRephrase.rephrasedRange);

      // Delete the original text
      const edit = new WorkspaceEdit();
      edit.replace(document.uri, this.activeRephrase.originalRange, rephrasedText);
      await workspace.applyEdit(edit);

      // Clean up the inserted rephrased text and newlines
      const cleanEdit = new WorkspaceEdit();
      const cleanRange = new Range(
        this.activeRephrase.originalRange.end,
        new Position(
          this.activeRephrase.rephrasedRange.end.line + 1,
          0
        )
      );
      cleanEdit.delete(document.uri, cleanRange);
      await workspace.applyEdit(cleanEdit);

      // Clean up any decorations
      await this.cleanupRephrase();
    } catch (error) {
      window.showErrorMessage(`Error accepting rephrased text: ${error}`);
      await this.cleanupRephrase();
    }
  }

  // Reject the rephrased text (delete it, keep original)
  async rejectRephrase() {
    if (!this.activeRephrase || !this.activeRephrase.rephrasedRange) {
      return;
    }

    try {
      // Delete the rephrased text and newlines
      const document = this.activeRephrase.document;
      const edit = new WorkspaceEdit();

      // Delete from the line after original to the line after rephrased
      const deleteRange = new Range(
        new Position(this.activeRephrase.originalRange.end.line + 1, 0),
        new Position(this.activeRephrase.rephrasedRange.end.line + 1, 0)
      );

      edit.delete(document.uri, deleteRange);
      await workspace.applyEdit(edit);

      // Clean up decorations
      await this.cleanupRephrase();
    } catch (error) {
      window.showErrorMessage(`Error rejecting rephrased text: ${error}`);
      await this.cleanupRephrase();
    }
  }

  // Clean up decorations and stored data
  private async cleanupRephrase() {
    if (!this.activeRephrase) {
      return;
    }

    // Dispose decorations
    if (this.activeRephrase.originalDecoration) {
      this.activeRephrase.originalDecoration.dispose();
    }

    if (this.activeRephrase.rephrasedDecoration) {
      this.activeRephrase.rephrasedDecoration.dispose();
    }

    // Clear the active rephrase
    this.activeRephrase = null;

    // Refresh codelenses
    this.codeLensEventEmitter.fire();
  }
}
