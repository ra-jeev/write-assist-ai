import { OpenAI, APIError } from 'openai';
import type { LanguageConfig, OpenAIConfig } from '../types';

const ERROR_MESSAGES = {
  NO_API_KEY: 'No API key provided.',
  FAILED_TO_PROCESS: 'Failed to process.',
  NO_CHOICES_RETURNED: 'No choices returned by the API.',
  EMPTY_CONTENT: 'Empty content returned by the API.',
  TOKENS_LIMIT: 'The AI response was cut short because it reached the token limit. You can increase the "Max Tokens" setting or retry without a limit.',
};

export class TokenLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenLimitError';
  }
}

export class OpenAIService {
  private readonly openAiSvc: OpenAI;
  private _config: OpenAIConfig;
  private _systemPrompt: LanguageConfig<string>;
  private _proxyUrl: string | undefined;

  constructor(
    apiKey: string,
    config: OpenAIConfig,
    systemPrompt: LanguageConfig<string>,
    proxyUrl?: string,
  ) {
    this.openAiSvc = new OpenAI({
      apiKey,
      baseURL: proxyUrl,
    });

    this._config = config;
    this._systemPrompt = systemPrompt;
    this._proxyUrl = proxyUrl;
  }

  set config(config: OpenAIConfig) {
    this._config = config;
  }

  set systemPrompt(systemPrompt: LanguageConfig<string>) {
    this._systemPrompt = systemPrompt;
  }

  private getSystemPrompt(languageId: string) {
    if (languageId in this._systemPrompt) {
      return this._systemPrompt[languageId];
    }

    return this._systemPrompt.default;
  }

  private isNewModel(model: string) {
    return /^(gpt-4.1|gpt-5|o1|o3|o4)/.test(model);
  }

  private validateModelSelection() {
    if (this._proxyUrl && (!this._config.isCustomModel || !this._config.model)) {
      return 'When using a proxy URL, you must set a custom model in the settings.';
    } else if (!this._config.model) {
      return 'No model set. Please set a custom model when choosing "Custom" from the dropdown.';
    }

    return null;
  }

  async createChatCompletion(
    cmdPrompt: string,
    text: string,
    languageId: string,
    callOptions: { ignoreMaxTokens?: boolean } = {},
  ): Promise<string> {
    try {
      const errorMsg = this.validateModelSelection();
      if (errorMsg) {
        throw new Error(errorMsg);
      }

      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      const isNewModel = this.isNewModel(this._config.model);
      const systemPrompt = this.getSystemPrompt(languageId);
      if (systemPrompt) {
        messages.push({
          role: isNewModel ? 'developer' : 'system',
          content: systemPrompt,
        });
      }

      const userPrompt = `${cmdPrompt}${cmdPrompt.endsWith(':') ? '\n\n' : ':\n\n'}${text}`;
      messages.push({ role: 'user', content: userPrompt });

      const options: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: this._config.model,
        ...(isNewModel
          ? { max_completion_tokens: this._config.maxTokens }
          : { max_tokens: this._config.maxTokens, temperature: this._config.temperature, }),
        messages,
        n: 1,
      };

      if (callOptions.ignoreMaxTokens) {
        delete options.max_tokens;
        delete options.max_completion_tokens;
      }
      
      const response = await this.openAiSvc.chat.completions.create(options);
      
      if (response.choices.length) {
        const choice = response.choices[0];

        if (choice.finish_reason === 'length') {
          throw new TokenLimitError(ERROR_MESSAGES.TOKENS_LIMIT);
        }

        const finalContent = choice.message.content?.trim();
        if (!finalContent) {
          throw new Error(ERROR_MESSAGES.EMPTY_CONTENT);
        }

        return finalContent;
      }

      throw new Error(ERROR_MESSAGES.NO_CHOICES_RETURNED);
    } catch (error) {
      if (error instanceof TokenLimitError) {
        throw error;
      }

      let errMessage = ERROR_MESSAGES.FAILED_TO_PROCESS;
      if (error instanceof APIError) {
        errMessage = `${error.name}: ${error.type}: ${error.code ? error.code + ': ' + error.message : error.message}`;
      } else if (error instanceof Error) {
        errMessage = `Error: ${error.message}`;
      }

      throw new Error(errMessage);
    }
  }
}