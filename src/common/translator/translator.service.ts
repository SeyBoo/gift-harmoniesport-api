import { Injectable, Logger } from '@nestjs/common';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from './translator.constant';

@Injectable()
export class TranslatorService {
  private translate: Translate;
  private readonly logger = new Logger(TranslatorService.name);
  constructor() {
    this.translate = new Translate({
      key: process.env.TRANSLATOR_API_KEY,
    });
  }
  async translateText(
    text: string,
    targetLanguage: SupportedLanguage,
  ): Promise<string> {
    try {
      const [translation] = await this.translate.translate(
        text,
        targetLanguage,
      );
      return translation;
    } catch (error) {
      this.logger.error(error);
    }
    return null;
  }

  async translateAll(
    text: string,
    sourceLanguage: SupportedLanguage = 'fr',
  ): Promise<Record<SupportedLanguage, string>> {
    try {
      const translations = await Promise.all(
        SUPPORTED_LANGUAGES.map(async (targetLang) => {
          if (targetLang === sourceLanguage) {
            return [targetLang, text];
          }
          const translation = await this.translateText(text, targetLang);
          return [targetLang, translation];
        }),
      );

      return Object.fromEntries(translations);
    } catch (error) {
      this.logger.error(error);
    }
    return null;
  }
}
