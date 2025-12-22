import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateLegalTable1746000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'legal',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'language',
            type: "enum",
            enum: ['fr', 'en'],
            isNullable: false,
          },
          {
            name: 'type',
            type: "enum",
            enum: ['privacy', 'legal', 'terms'],
            isNullable: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('legal');
  }
} 