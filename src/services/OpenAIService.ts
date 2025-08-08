import { OpenAI, APIError } from 'openai';
import type { LanguageConfig, OpenAIConfig } from '../types';

const ERROR_MESSAGES = {
  NO_API_KEY: 'No API key provided.',
  FAILED_TO_PROCESS: 'Failed to process.',
  NO_CHOICES_RETURNED: 'No choices returned by the API.',
  EMPTY_CONTENT: 'Empty content returned by the API.',
};

export class OpenAIService {
  private readonly openAiSvc: OpenAI;
  private _config: OpenAIConfig;
  private _systemPrompt: LanguageConfig<string>;

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
    return /^(gpt-5|o3|o4)/.test(model);
  }

  async createChatCompletion(
    cmdPrompt: string,
    text: string,
    languageId: string,
  ): Promise<string> {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [];

      const systemPrompt = this.getSystemPrompt(languageId);
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      const userPrompt = `${cmdPrompt}${
        cmdPrompt.endsWith(':') ? '\n\n' : ':\n\n'
      }${text}`;
      messages.push({ role: 'user', content: userPrompt });

      const options = {
        model: this._config.model,
        ...(this.isNewModel(this._config.model)
          ? { max_completion_tokens: this._config.maxTokens }
          : { max_tokens: this._config.maxTokens, temperature: this._config.temperature, }),
        n: 1,
      };

      const response = await this.openAiSvc.chat.completions.create({
        messages,
        ...options
      });

      if (response.choices.length) {
        const finalContent = response.choices[0].message.content?.trim();
        if (!finalContent) {
          throw new Error(ERROR_MESSAGES.EMPTY_CONTENT);
        }

        return finalContent;
      }

      throw new Error(ERROR_MESSAGES.NO_CHOICES_RETURNED);
    } catch (error) {
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
