import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHandleDistribution1745389579738 implements MigrationInterface {
  name = 'AddHandleDistribution1745389579738';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('campaign', 'handle_distribution');
    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`campaign\`
        ADD COLUMN \`handle_distribution\` BOOLEAN NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('campaign', 'handle_distribution');
    if (hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`campaign\`
        DROP COLUMN \`handle_distribution\`
      `);
    }
  }
}
