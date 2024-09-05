import { OpenAI, APIError } from 'openai';
import { LanguageConfig } from '../ExtensionConfig';

export type OpenAiConfig = {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: LanguageConfig<string>;
};

export class OpenAiService {
  private readonly openAiSvc: OpenAI;
  private _config: OpenAiConfig;

  constructor(apiKey: string, config: OpenAiConfig, proxyUrl?: string) {
    this.openAiSvc = new OpenAI({
      apiKey,
      baseURL: proxyUrl || undefined,
    });

    this._config = config;
  }

  set config(config: OpenAiConfig) {
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

      let finalContent = 'Warning: No choices returned by the API.';
      if (response.choices.length) {
        finalContent = response.choices[0].message.content
          ? response.choices[0].message.content.trim()
          : 'Warning: Empty content received from the API.';
      }

      return finalContent;
    } catch (error) {
      let errMessage = '';
      if (error instanceof APIError) {
        errMessage = `${error.name}: ${error.type}: ${
          error.code ? error.code + ': ' + error.message : error.message
        }`;
      } else {
        errMessage = `Error: ${(error as any).message ?? 'Failed to process'}`;
      }

      throw new Error(errMessage);
    }
  }
}
