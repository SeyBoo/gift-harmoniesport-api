import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureCustomLogoCampaign1711467000000 implements MigrationInterface {
  name = 'EnsureCustomLogoCampaign1711467000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists
    const hasColumn = await queryRunner.hasColumn('campaign', 'custom_logo');
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE \`campaign\` ADD COLUMN \`custom_logo\` varchar(255) NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('campaign', 'custom_logo');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE \`campaign\` DROP COLUMN \`custom_logo\``);
    }
  }
} 