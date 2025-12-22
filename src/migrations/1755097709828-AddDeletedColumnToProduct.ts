import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the 'deleted' column to the 'product' table.
 * This allows products to be soft deleted instead of hard deleted when they have purchases.
 */
export class AddDeletedColumnToProduct1755097709828 implements MigrationInterface {
  name = 'AddDeletedColumnToProduct1755097709828';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`deleted\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`deleted\``);
  }
}
