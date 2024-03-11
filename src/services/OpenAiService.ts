import { OpenAI, APIError } from 'openai';

export class OpenAiService {
  private readonly openAiSvc: OpenAI;
  private maxTokens: number;

  constructor(apiKey: string, maxTokens: number = 1200) {
    this.openAiSvc = new OpenAI({
      apiKey,
    });

    this.maxTokens = maxTokens;
  }

  async createCompletion(prompt: string): Promise<string> {
    try {
      /* eslint-disable @typescript-eslint/naming-convention */
      const response = await this.openAiSvc.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt,
        temperature: 0.3,
        max_tokens: this.maxTokens,
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
        errMessage = `Error: ${error.code}: ${error.message}`;
      } else {
        errMessage = `Error: ${(error as any).message ?? 'Failed to process'}`;
      }

      throw new Error(errMessage);
    }
  }
}
