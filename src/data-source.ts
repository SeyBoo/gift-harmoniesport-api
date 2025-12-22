import { DataSource } from 'typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  entities: [join(__dirname, 'entities/*.entity{.ts,.js}')],
  charset: 'utf8mb4',
  logging: process.env.NODE_ENV !== 'production',
  connectTimeout: 60000,
  acquireTimeout: 60000,
  ...(process.env.DATABASE_SSL
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {}),
});

export default dataSource;
