import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstnameLastnameToOrder1749644343000 implements MigrationInterface {
  name = 'AddFirstnameLastnameToOrder1749644343000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFirstnameColumn = await queryRunner.hasColumn('order', 'firstname');
    if (!hasFirstnameColumn) {
      await queryRunner.query(`
        ALTER TABLE \`order\`
        ADD COLUMN \`firstname\` VARCHAR(255) NULL
      `);
    }

    const hasLastnameColumn = await queryRunner.hasColumn('order', 'lastname');
    if (!hasLastnameColumn) {
      await queryRunner.query(`
        ALTER TABLE \`order\`
        ADD COLUMN \`lastname\` VARCHAR(255) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasFirstnameColumn = await queryRunner.hasColumn('order', 'firstname');
    if (hasFirstnameColumn) {
      await queryRunner.query(`
        ALTER TABLE \`order\`
        DROP COLUMN \`firstname\`
      `);
    }

    const hasLastnameColumn = await queryRunner.hasColumn('order', 'lastname');
    if (hasLastnameColumn) {
      await queryRunner.query(`
        ALTER TABLE \`order\`
        DROP COLUMN \`lastname\`
      `);
    }
  }
} 