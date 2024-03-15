import { OpenAI, APIError } from 'openai';

export type OpenAiConfig = {
  model: string;
  maxTokens: number;
  temperature: number;
};

export class OpenAiService {
  private readonly openAiSvc: OpenAI;
  private config: OpenAiConfig;

  constructor(apiKey: string, config: OpenAiConfig) {
    this.openAiSvc = new OpenAI({
      apiKey,
    });

    this.config = config;
  }

  async createChatCompletion(cmdPrompt: string, text: string): Promise<string> {
    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: cmdPrompt },
        { role: 'user', content: text },
      ];

      /* eslint-disable @typescript-eslint/naming-convention */
      const response = await this.openAiSvc.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
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

  async createCompletion(prompt: string): Promise<string> {
    try {
      /* eslint-disable @typescript-eslint/naming-convention */
      const response = await this.openAiSvc.completions.create({
        model: this.config.model,
        prompt,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        n: 1,
      });
      /* eslint-enable @typescript-eslint/naming-convention */

      if (response.choices.length) {
        return response.choices[0].text.trim();
      } else {
        throw new Error('Error: Choices returned by OpenAI is 0');
      }
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
