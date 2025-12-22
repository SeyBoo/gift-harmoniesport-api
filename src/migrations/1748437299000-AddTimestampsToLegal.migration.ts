import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimestampsToLegal1748437299000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('legal');
    
    const createdAtColumn = table.findColumnByName('created_at');
    if (!createdAtColumn) {
      await queryRunner.query(
        `ALTER TABLE legal ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`
      );
    } else {
      await queryRunner.query(
        `ALTER TABLE legal MODIFY COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`
      );
    }

    const updatedAtColumn = table.findColumnByName('updated_at');
    if (!updatedAtColumn) {
      await queryRunner.query(
        `ALTER TABLE legal ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
      );
    } else {
      await queryRunner.query(
        `ALTER TABLE legal MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE legal DROP COLUMN updated_at`);
    await queryRunner.query(`ALTER TABLE legal DROP COLUMN created_at`);
  }
} 