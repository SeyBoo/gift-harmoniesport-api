import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlayerFaceUrlAndPrintUrlToProduct1755105000000
  implements MigrationInterface
{
  name = 'AddPlayerFaceUrlAndPrintUrlToProduct1755105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`player_face_url\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product\` ADD \`print_url\` varchar(255) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`print_url\``);
    await queryRunner.query(
      `ALTER TABLE \`product\` DROP COLUMN \`player_face_url\``,
    );
  }
}
