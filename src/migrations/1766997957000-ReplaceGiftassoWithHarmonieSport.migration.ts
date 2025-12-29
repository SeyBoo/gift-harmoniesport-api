import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceGiftassoWithHarmonieSport1766997957000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update Legal table content - replace Giftasso/GiftAsso with Harmonie Sport
    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'Giftasso', 'Harmonie Sport')
      WHERE content LIKE '%Giftasso%'
    `);

    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'GiftAsso', 'Harmonie Sport')
      WHERE content LIKE '%GiftAsso%'
    `);

    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'giftasso', 'Harmonie Sport')
      WHERE content LIKE '%giftasso%'
    `);

    // Update FAQ table - question field (JSON)
    await queryRunner.query(`
      UPDATE faq
      SET question = REPLACE(question, 'Giftasso', 'Harmonie Sport')
      WHERE question LIKE '%Giftasso%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET question = REPLACE(question, 'GiftAsso', 'Harmonie Sport')
      WHERE question LIKE '%GiftAsso%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET question = REPLACE(question, 'giftasso', 'Harmonie Sport')
      WHERE question LIKE '%giftasso%'
    `);

    // Update FAQ table - answer field (JSON)
    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'Giftasso', 'Harmonie Sport')
      WHERE answer LIKE '%Giftasso%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'GiftAsso', 'Harmonie Sport')
      WHERE answer LIKE '%GiftAsso%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'giftasso', 'Harmonie Sport')
      WHERE answer LIKE '%giftasso%'
    `);

    // Update FAQ table - category field (JSON)
    await queryRunner.query(`
      UPDATE faq
      SET category = REPLACE(category, 'Giftasso', 'Harmonie Sport')
      WHERE category LIKE '%Giftasso%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET category = REPLACE(category, 'GiftAsso', 'Harmonie Sport')
      WHERE category LIKE '%GiftAsso%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET category = REPLACE(category, 'giftasso', 'Harmonie Sport')
      WHERE category LIKE '%giftasso%'
    `);

    // Also replace giftasso.com URLs with harmoniesport.giftasso.com
    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'www.giftasso.com', 'harmoniesport.giftasso.com')
      WHERE content LIKE '%www.giftasso.com%'
    `);

    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'giftasso.com', 'harmoniesport.giftasso.com')
      WHERE content LIKE '%giftasso.com%' AND content NOT LIKE '%harmoniesport.giftasso.com%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'www.giftasso.com', 'harmoniesport.giftasso.com')
      WHERE answer LIKE '%www.giftasso.com%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'giftasso.com', 'harmoniesport.giftasso.com')
      WHERE answer LIKE '%giftasso.com%' AND answer NOT LIKE '%harmoniesport.giftasso.com%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the changes - replace Harmonie Sport back to Giftasso
    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'Harmonie Sport', 'Giftasso')
      WHERE content LIKE '%Harmonie Sport%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET question = REPLACE(question, 'Harmonie Sport', 'Giftasso')
      WHERE question LIKE '%Harmonie Sport%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'Harmonie Sport', 'Giftasso')
      WHERE answer LIKE '%Harmonie Sport%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET category = REPLACE(category, 'Harmonie Sport', 'Giftasso')
      WHERE category LIKE '%Harmonie Sport%'
    `);

    // Reverse URL changes
    await queryRunner.query(`
      UPDATE legal
      SET content = REPLACE(content, 'harmoniesport.giftasso.com', 'giftasso.com')
      WHERE content LIKE '%harmoniesport.giftasso.com%'
    `);

    await queryRunner.query(`
      UPDATE faq
      SET answer = REPLACE(answer, 'harmoniesport.giftasso.com', 'giftasso.com')
      WHERE answer LIKE '%harmoniesport.giftasso.com%'
    `);
  }
}
