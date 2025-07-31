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
}

export const CONFIG_SECTION_KEY = 'writeAssistAi';
export const OPEN_AI_API_KEY_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.openAiApiKey}`;
export const ACCEPT_REPHRASE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.acceptRephrase}`;
export const REJECT_REPHRASE_CMD = `${CONFIG_SECTION_KEY}.${CommandKeys.rejectRephrase}`;
