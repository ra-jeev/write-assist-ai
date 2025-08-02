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
  systemPrompt: LanguageConfig<string>;
};

export type CommandsChangeListener = () => void;
export type SecretChangeListener = (key: string) => void;

export type FileConfigType = 'system-prompt' | 'commands';
export type FileConfigChangeListener = (type: FileConfigType) => void;
