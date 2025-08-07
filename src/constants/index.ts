export const DEFAULT_MAX_TOKENS = 1200;
export const DEFAULT_TEMPERATURE = 0.3;
export const DEFAULT_MODEL = 'gpt-4o';

// Keys for the extensions configuration settings
export enum ConfigurationKeys {
  deprecatedOpenAiApiKey = 'openAiApiKey',
  openAiApiKey = 'openAi.apiKey',
  maxTokens = 'maxTokens',
  temperature = 'temperature',
  model = 'openAi.model',
  customModel = 'openAi.customModel',
  proxyUrl = 'openAi.proxyUrl',
  quickFixes = 'quickFixes',
  rewriteOptions = 'rewriteOptions',
  systemPrompt = 'systemPrompt',
  separator = 'separatorText',
  useAcceptRejectFlow = 'useAcceptRejectFlow',
}

// Keys for the VSCode Command Pallette or other inEditor
// commands that this extension provides
export enum CommandKeys {
  openAiApiKey = 'openAiApiKey',
  acceptRephrase = 'acceptRephrase',
  rejectRephrase = 'rejectRephrase',
  createSystemPromptFile = 'createSystemPromptFile',
  createQuickFixesFile = 'createQuickFixesFile',
  createRewriteOptionsFile = 'createRewriteOptionsFile',
}

export const CONFIG_SECTION_KEY = 'writeAssistAi';
export const OPEN_AI_API_KEY_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.openAiApiKey}`;
export const ACCEPT_REPHRASE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.acceptRephrase}`;
export const REJECT_REPHRASE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.rejectRephrase}`;
export const CREATE_SYSTEM_PROMPT_FILE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.createSystemPromptFile}`;
export const CREATE_QUICK_FIXES_FILE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.createQuickFixesFile}`;
export const CREATE_REWRITE_OPTIONS_FILE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.createRewriteOptionsFile}`;

export const CONFIG_DIR = '.write-assist-ai';
export const SYSTEM_PROMPT_FILE = 'systemPrompt.md';
export const QUICK_FIXES_FILE = 'quickFixes.json';
export const REWRITE_OPTIONS_FILE = 'rewriteOptions.json';

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant. Your job is to perform the tasks related to rewriting text inputs given by the user.
If the input text contains any special syntax then strictly follow that syntax, e.g. for markdown return markdown, for latex return latex etc.
Do not return markdown for latex, and vice versa.
You must return only the modified output.
Do not explain, greet, apologize, or add any commentary.
Do not say things like ‘here is the revised text’.
Simply return the text as if you're a function returning a value.`;

export const DEFAULT_QUICK_FIXES = [
  {
    title: 'Rephrase the selected text',
    description: 'Rephrases the selected text',
    prompt:
      'Rephrase the given text and make the sentences more clear and readable.',
  },
  {
    title: 'Suggest headlines for selection',
    description: 'Suggests some appropriate headlines for the selected text',
    prompt: 'Suggest 2-3 short headlines based on the given text.',
  },
];

export const DEFAULT_REWRITE_OPTIONS = [
  {
    title: 'Change to professional tone',
    description: 'Changes the selected text\'s tone to professional',
    prompt: 'Make the given text better and rewrite it in a professional tone.',
  },
  {
    title: 'Change to casual tone',
    description: 'Changes the selected text\'s tone to casual',
    prompt: 'Make the given text better and rewrite it in a casual tone.',
  },
];
