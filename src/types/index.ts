import { ConfigurationKeys } from '../constants';

export type WritingAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

export type ExtensionActions = {
  quickFixes: LanguageConfig<WritingAction[]>;
  rewriteOptions: LanguageConfig<WritingAction[]>;
};

export type LanguageConfig<T> = {
  [key: string]: T;
  default: T;
};

export type ReasoningEffort = 'auto' | 'minimal' | 'low' | 'medium' | 'high';
export type OpenAIConfig = {
  model: string;
  maxTokens: number;
  temperature: number;
  isCustomModel: boolean;
  reasoningEffort?: ReasoningEffort;
};

export type CommandsChangeListener = () => void;
export type SecretChangeListener = (key: string) => void;

export type FileConfigType =
  | ConfigurationKeys.systemPrompt
  | ConfigurationKeys.quickFixes
  | ConfigurationKeys.rewriteOptions;
export type FileConfigChangeListener = (type: FileConfigType) => void;

export type OpenAIConfigChangeType = 'reset' | 'config' | 'systemPrompt';
export type OpenAIConfigChangeListener = (type: OpenAIConfigChangeType) => void;
