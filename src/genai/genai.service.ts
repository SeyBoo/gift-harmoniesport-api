import { Injectable, Logger } from '@nestjs/common';
import { MidjourneyApiResponse } from './types/genai.interface';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class GenaiService {
  constructor(private readonly httpService: HttpService) {}

  private readonly logger = new Logger(GenaiService.name);
  private token = process.env.MIDJOURNEY_TOKEN;

  public async generateCard(prompt: string): Promise<MidjourneyApiResponse> {
    try {
      const response = await this.httpService.axiosRef.post(
        'https://cl.imagineapi.dev/items/images/',
        {
          prompt,
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.data;
    } catch (e) {
      console.log(e);
      this.logger.error(e);
    }
    return null;
  }

  public async getGenerationStatus(id: string): Promise<MidjourneyApiResponse> {
    try {
      const response = await this.httpService.axiosRef.get(
        `https://cl.imagineapi.dev/items/images/${id}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.data;
    } catch (e) {
      this.logger.error(e);
    }
    return null;
  }
}
