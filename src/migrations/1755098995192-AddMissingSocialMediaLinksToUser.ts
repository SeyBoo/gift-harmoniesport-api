import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds missing social media link columns to the 'user' table.
 * Based on the error message, twitter_link, youtube_link, and linkedin_link are missing.
 * Note: facebook_link and instagram_link already exist, and tiktok_link was added previously.
 */
export class AddMissingSocialMediaLinksToUser1755098995192 implements MigrationInterface {
  name = 'AddMissingSocialMediaLinksToUser1755098995192';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add twitter_link column
    try {
      await queryRunner.query(
        `ALTER TABLE \`user\` ADD \`twitter_link\` varchar(255) NULL`,
      );
    } catch (error) {
      // Column might already exist, continue
    }

    // Add youtube_link column (for backward compatibility)
    try {
      await queryRunner.query(
        `ALTER TABLE \`user\` ADD \`youtube_link\` varchar(255) NULL`,
      );
    } catch (error) {
      // Column might already exist, continue
    }

    // Add linkedin_link column
    try {
      await queryRunner.query(
        `ALTER TABLE \`user\` ADD \`linkedin_link\` varchar(255) NULL`,
      );
    } catch (error) {
      // Column might already exist, continue
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`linkedin_link\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`youtube_link\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`twitter_link\``);
  }
}
