import { OpenAIService } from './OpenAIService';
import { ExtensionConfig } from '../config/ExtensionConfig';

export class AIServiceFactory {
  private openAIService: OpenAIService | null = null;

  constructor(private config: ExtensionConfig) {
    this.config.registerOpenAiConfigChangeListener(
      this.onConfigChange.bind(this)
    );
  }

  async getService(): Promise<OpenAIService> {
    if (!this.openAIService) {
      let apiKey = await this.config.getOpenAiApiKey();
      if (!apiKey) {
        apiKey = await this.config.promptUserForApiKey();
        if (!apiKey) {
          throw new Error('Error: Couldn\'t initialize AI service, no API key provided.');
        }
      }

      this.openAIService = new OpenAIService(
        apiKey,
        this.config.getOpenAIConfig(),
        this.config.getSystemPrompt(),
        this.config.getOpenAIProxyUrl()
      );
    }

    return this.openAIService;
  }

  private onConfigChange(resetOpenAISvc: boolean) {
    if (resetOpenAISvc) {
      this.openAIService = null;
    } else if (this.openAIService) {
      this.openAIService.config = this.config.getOpenAIConfig();
    }
  }
}
