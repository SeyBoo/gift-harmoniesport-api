import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the 'deleted' column from the 'product' table.
 * This reverts the soft delete functionality and returns to hard delete only.
 */
export class RemoveDeletedColumnFromProduct1755104373849 implements MigrationInterface {
  name = 'RemoveDeletedColumnFromProduct1755104373849';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`deleted\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`deleted\` tinyint NOT NULL DEFAULT 0`,
    );
  }
}
