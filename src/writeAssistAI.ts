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
import {
  ExtensionConfig,
  type LanguageConfig,
  type WritingAction,
} from './ExtensionConfig';

export class WriteAssistAI implements CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    CodeActionKind.RefactorRewrite,
    CodeActionKind.QuickFix,
  ];

  private openAiSvc: OpenAiService | undefined;
  private allCommands: string[] = [];
  private actions: LanguageConfig<CodeAction[]> = { default: [] };
  private currRange: Range | undefined;
  private extensionConfig: ExtensionConfig;
  private currentlyProcessing = false;

  constructor(config: ExtensionConfig) {
    this.extensionConfig = config;
    this.prepareActionsFromConfig();
    this.extensionConfig.registerOpenAiConfigChangeListener(
      (isApiKeyChange: boolean) => this.onOpenAiApiConfigChange(isApiKeyChange)
    );
  }

  onOpenAiApiConfigChange(apiKeyChanged: boolean) {
    if (apiKeyChanged) {
      this.openAiSvc = undefined;
    } else if (this.openAiSvc) {
      this.openAiSvc.config = this.extensionConfig.getOpenAIConfig();
    }
  }

  prepareActionsFromConfig() {
    const actionsFromConfig = this.extensionConfig.getActions();
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

    return this.actions[document.languageId] ?? this.actions.default;
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

  async createOpenAiSvc(): Promise<OpenAiService | undefined> {
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
    const openAiSvc = await this.createOpenAiSvc();
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
      message = await openAiSvc.createChatCompletion(
        prompt,
        text,
        editor.document.languageId
      );
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
