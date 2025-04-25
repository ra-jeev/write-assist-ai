import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  CodeLens,
  CodeLensProvider,
  DecorationRenderOptions,
  EventEmitter,
  Position,
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
import { ExtensionConfig } from './config/ExtensionConfig';
import { ACCEPT_REPHRASE_CMD, CONFIG_SECTION_KEY, REJECT_REPHRASE_CMD } from './constants';
import type { LanguageConfig, WritingAction } from './types';

type DecorationWithRange = {
  range: Range;
  decoration: TextEditorDecorationType;
}

type RephraseTask = {
  document: TextDocument;
  original?: DecorationWithRange;
  rephrased?: DecorationWithRange;
}

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

  async insertText(document: TextDocument, location: Position, text: string, addSeparator = true) {
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
    edit.insert(Uri.parse(document.uri.toString()), location, textWithSeparator.join('\n'));

    const response = await workspace.applyEdit(edit);
    if (response) {
      const lines = text.split('\n');

      const startLine = location.line + newLinesAdded;
      const endLine = startLine + lines.length - 1;

      return new Range(new Position(startLine, 0), new Position(endLine, lines[lines.length - 1].length));
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
    decorations: { type: 'original' | 'rephrased', range: Range, decorationOptions: DecorationRenderOptions }[]
  ) {
    this.activeRephrase = {
      document: editor.document,
    };

    for (const { type, range, decorationOptions } of decorations) {
      const decorationType = window.createTextEditorDecorationType(decorationOptions);
      this.activeRephrase[type] = {
        range,
        decoration: decorationType,
      };

      editor.setDecorations(decorationType, [range]);
    }
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

    // Show loading indicator while getting rephrased text
    await window.withProgress({
      location: ProgressLocation.Notification,
      title: "Generating rephrased text...",
      cancellable: true
    }, async (progress, token) => {
      // Listen for cancellation
      token.onCancellationRequested(() => {
        window.showInformationMessage('Rephrase cancelled.');
        return;
      });

      progress.report({ increment: 30 });

      try {
        const originalText = document.getText(range);
        const rephrasedText = await openAIService.createChatCompletion(
          prompt,
          originalText,
          document.languageId
        );

        if (token.isCancellationRequested) {
          // Simply return if the task was cancelled
          this.currentlyProcessing = false;
          return;
        }

        progress.report({ increment: 70 });

        const editor = this.getEditorIfValid(document);
        if (editor) {
          // Remove the existing selection
          editor.selection = new Selection(range.end, range.end);

          const rephrasedRange = await this.insertText(document, range.end, rephrasedText, false);
          if (rephrasedRange) {
            this.applyDecorations(editor, [
              {
                type: 'original',
                range,
                decorationOptions: {
                  backgroundColor: 'rgba(255, 182, 193, 0.2)',
                  border: '1px solid red',
                  isWholeLine: true,
                },
              },
              {
                type: 'rephrased',
                range: rephrasedRange,
                decorationOptions: {
                  backgroundColor: 'rgba(144, 255, 144, 0.2)',
                  border: '1px solid green',
                  isWholeLine: true,
                },
              }
            ]);

            // Trigger codelens refresh to show buttons
            this.codeLensEventEmitter.fire();
          }
        } else {
          // If no valid editor is found, directly insert the rephrased text
          await this.insertText(document, range.end, rephrasedText);
        }
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
      !this.activeRephrase.original || !this.activeRephrase.rephrased) {
      return codeLenses;
    }


    // Create a range for the codelens (just after the rephrased text)
    const lensRange = new Range(
      this.activeRephrase.rephrased.range.end.line + 1, 0,
      this.activeRephrase.rephrased.range.end.line + 1, 0
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

  async deleteRephrase(document: TextDocument, rephrasedRange: Range) {
    // Need to also delete one newline after the rephrased text
    const deleteRange = new Range(
      rephrasedRange.start.line, rephrasedRange.start.character,
      rephrasedRange.end.line + 1, 0
    );

    // Delete the rephrased text and newline
    await this.deleteRange(document, deleteRange);
  }

  // Accept the rephrased text (keep it, delete original)
  async acceptRephrase() {
    if (!this.activeRephrase || !this.activeRephrase.original || !this.activeRephrase.rephrased) {
      return;
    }

    try {
      const rephrasedText = this.activeRephrase.document.getText(this.activeRephrase.rephrased.range);

      // Replace the original text with the rephrased text
      await this.replaceText(this.activeRephrase.document, this.activeRephrase.original.range, rephrasedText);

      // Delete the rephrased text
      this.deleteRephrase(this.activeRephrase.document, this.activeRephrase.rephrased.range);
    } catch (error) {
      window.showErrorMessage(`Error accepting rephrased text: ${error}`);
    }

    // Clean up any decorations
    await this.cleanupRephrase();
  }

  // Reject the rephrased text (delete it, keep original)
  async rejectRephrase() {
    if (!this.activeRephrase || !this.activeRephrase.original || !this.activeRephrase.rephrased) {
      return;
    }

    try {
      // Delete the rephrased text and newlines
      await this.deleteRephrase(this.activeRephrase.document, this.activeRephrase.rephrased.range);
    } catch (error) {
      window.showErrorMessage(`Error rejecting rephrased text: ${error}`);
    }

    // Clean up decorations
    await this.cleanupRephrase();
  }

  // Clean up decorations and stored data
  private async cleanupRephrase() {
    if (!this.activeRephrase || !this.activeRephrase.original || !this.activeRephrase.rephrased) {
      return;
    }

    // Dispose decorations
    this.activeRephrase.original.decoration.dispose();
    this.activeRephrase.rephrased.decoration.dispose();

    // Clear the active rephrase
    this.activeRephrase = null;

    // Refresh codelenses
    this.codeLensEventEmitter.fire();
  }
}
