export const DEFAULT_MAX_TOKENS = 1200;
export const DEFAULT_TEMPERATURE = 0.3;
export const DEFAULT_MODEL = 'gpt-4o';

export const ERROR_MESSAGES = {
  NO_API_KEY: 'No API key provided.',
  FAILED_TO_PROCESS: 'Error: Failed to process.',
  NO_CHOICES_RETURNED: 'Warning: No choices returned by the API.',
  EMPTY_CONTENT: 'Warning: Empty content received from the API.',
};

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
}

// Keys for the VSCode Command Pallette Commands
// that this extension provides
export enum CommandKeys {
  openAiApiKey = 'openAiApiKey',
}

export const CONFIG_SECTION_KEY = 'writeAssistAi';
export const OPEN_AI_API_KEY_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.openAiApiKey}`;
