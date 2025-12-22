import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the 'tiktok_link' column to the 'user' table.
 * This column stores TikTok profile links for users.
 */
export class AddTiktokLinkToUser1755098913609 implements MigrationInterface {
  name = 'AddTiktokLinkToUser1755098913609';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`tiktok_link\` varchar(255) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`tiktok_link\``);
  }
}
