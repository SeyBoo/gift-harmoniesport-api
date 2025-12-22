import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStart(): { success: boolean } {
    return { success: false };
  }
}
