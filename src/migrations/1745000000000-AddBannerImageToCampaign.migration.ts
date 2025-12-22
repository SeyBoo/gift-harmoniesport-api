import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBannerImageToCampaign1745000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists to avoid errors
    const table = await queryRunner.getTable('campaign');
    const columnExists = table.findColumnByName('banner_image');
    
    if (!columnExists) {
      await queryRunner.query(
        `ALTER TABLE campaign ADD COLUMN banner_image VARCHAR(255) NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaign DROP COLUMN banner_image`);
  }
} 