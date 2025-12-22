import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModifyVariantColumnType1745000000004 implements MigrationInterface {
  name = 'ModifyVariantColumnType1745000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`mass_import_item\` MODIFY COLUMN \`variant\` varchar(255) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`mass_import_item\` MODIFY COLUMN \`variant\` json NOT NULL`,
    );
  }
}
