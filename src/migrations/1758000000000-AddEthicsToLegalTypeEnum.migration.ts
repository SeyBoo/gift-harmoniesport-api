import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEthicsToLegalTypeEnum1758000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE legal MODIFY COLUMN type ENUM('privacy', 'legal', 'terms', 'ethics') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE legal MODIFY COLUMN type ENUM('privacy', 'legal', 'terms') NOT NULL`,
    );
  }
}