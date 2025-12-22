import '../src/instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { VercelRequest, VercelResponse } from '@vercel/node';
import * as bodyParser from 'body-parser';

let app: any;

async function bootstrap() {
  if (!app) {
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);

    app = await NestFactory.create(AppModule, adapter, {
      logger: ['error', 'warn'],
      bodyParser: false,
    });

    app.use(bodyParser.json({
      limit: '60mb',
      verify: (req: any, res, buf) => {
        if (req.url.includes('/webhook')) {
          req.rawBody = buf;
        }
      }
    }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '60mb' }));

    app.enableCors({
      origin: true,
    });
    app.useGlobalPipes(new ValidationPipe());

    await app.init();
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}
