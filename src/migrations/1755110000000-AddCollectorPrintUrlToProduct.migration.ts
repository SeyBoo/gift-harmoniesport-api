import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollectorPrintUrlToProduct1755110000000
  implements MigrationInterface
{
  name = 'AddCollectorPrintUrlToProduct1755110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`collector_print_url\` varchar(255) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`collector_print_url\``);
  }
}