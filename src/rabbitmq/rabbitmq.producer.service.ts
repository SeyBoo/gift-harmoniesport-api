import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class RabbitMQService {
  private logger = new Logger(RabbitMQService.name);
  constructor(
    @Inject('rabbit-mq-giftasso') private readonly client: ClientProxy,
  ) {}

  public async send(pattern: string, data: any) {
    try {
      return this.client.send(pattern, data).toPromise();
    } catch (error) {
      this.logger.error(`RabbitMQ service did not return any data: ${error.message}`);
    }
  }
}
