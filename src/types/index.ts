export type WritingAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export type ExtensionActions = {
  quickFixes: LanguageConfig<WritingAction[]>;
  rewriteActions: LanguageConfig<WritingAction[]>;
};

export type LanguageConfig<T> = {
  [key: string]: T;
  default: T;
};

export type OpenAIConfig = {
  model: string;
  maxTokens: number;
  temperature: number;
};

export type CommandsChangeListener = () => void;
export type SecretChangeListener = (key: string) => void;

export type FileConfigType = 'systemPrompt' | 'quickFixes' | 'rewriteOptions';
export type FileConfigChangeListener = (type: FileConfigType) => void;

export type OpenAIConfigChangeType = 'reset' | 'config' | 'systemPrompt'
export type OpenAIConfigChangeListener = (type: OpenAIConfigChangeType) => void