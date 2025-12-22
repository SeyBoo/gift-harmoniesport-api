if (process.env.DD_TRACE_ENABLED !== 'false') {
  require('dd-trace/init');
}
import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { createLogger, transports, format } from 'winston';
import { LogtailTransport } from '@logtail/winston';
import { Logtail } from '@logtail/node';
import { Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      bodyParser: false, // Disable default body parser
    });

    // Apply body parsers selectively
    app.use(
      bodyParser.json({
        verify: (req: any, res, buf) => {
          if (req.url.includes('/webhook')) {
            req.rawBody = buf;
          }
        },
      }),
    );
    app.use(bodyParser.urlencoded({ extended: true }));

    app.enableCors({
      origin: true,
    });
    app.useGlobalPipes(new ValidationPipe());

    if (process.env.LOGTAIL_TOKEN) {
      const logtail = new Logtail(process.env.LOGTAIL_TOKEN, {
        endpoint: 'https://s1369509.eu-nbg-2.betterstackdata.com',
      });
      const logger = createLogger({
        level: 'info',
        format: format.combine(format.timestamp(), format.json()),
        defaultMeta: { app: process.env.APP_NAME || 'ekinsport-api' },
        transports: [new transports.Console(), new LogtailTransport(logtail)],
        levels: {
          error: 0,
          warn: 1,
          log: 2,
          debug: 3,
          verbose: 4,
        },
      });

      Logger.overrideLogger(logger);
    }
    if (process.env.NODE_ENV === 'prod') {
      app.useGlobalFilters(new AllExceptionsFilter());
    }
    await app.listen(process.env.PORT || 8080);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}
bootstrap();
