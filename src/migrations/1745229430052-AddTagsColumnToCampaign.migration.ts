import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1745229430052 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE campaign ADD COLUMN tags TEXT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE campaign DROP COLUMN tags`);
    }

}
