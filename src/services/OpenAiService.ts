import { OpenAI, APIError } from 'openai';
import type { OpenAIConfig } from '../types';
import { ERROR_MESSAGES } from '../constants';

export class OpenAIService {
  private readonly openAiSvc: OpenAI;
  private _config: OpenAIConfig;

  constructor(apiKey: string, config: OpenAIConfig, proxyUrl?: string) {
    this.openAiSvc = new OpenAI({
      apiKey,
      baseURL: proxyUrl || undefined,
    });

    this._config = config;
  }

  set config(config: OpenAIConfig) {
    this._config = config;
  }

  getSystemPrompt(languageId: string) {
    if (languageId in this._config.systemPrompt) {
      return this._config.systemPrompt[languageId];
    }

    return this._config.systemPrompt.default;
  }

  async createChatCompletion(
    cmdPrompt: string,
    text: string,
    languageId: string
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

      /* eslint-disable @typescript-eslint/naming-convention */
      const response = await this.openAiSvc.chat.completions.create({
        model: this._config.model,
        messages,
        temperature: this._config.temperature,
        max_tokens: this._config.maxTokens,
        n: 1,
      });
      /* eslint-enable @typescript-eslint/naming-convention */

      let finalContent = ERROR_MESSAGES.NO_CHOICES_RETURNED;
      if (response.choices.length) {
        finalContent =
          response.choices[0].message.content?.trim() ||
          ERROR_MESSAGES.EMPTY_CONTENT;
      }

      return finalContent;
    } catch (error) {
      let errMessage = ERROR_MESSAGES.FAILED_TO_PROCESS;
      if (error instanceof APIError) {
        errMessage = `${error.name}: ${error.type}: ${
          error.code ? error.code + ': ' + error.message : error.message
        }`;
      } else if (error instanceof Error) {
        errMessage = `Error: ${error.message}`;
      }

      throw new Error(errMessage);
    }
  }
}
