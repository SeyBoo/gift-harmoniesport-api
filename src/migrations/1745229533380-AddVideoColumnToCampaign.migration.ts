import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1745229533380 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('campaign');
        const videoColumn = table.findColumnByName('video');
        if (!videoColumn) {
            await queryRunner.query(`ALTER TABLE campaign ADD COLUMN video VARCHAR(255) NULL`);
        } else {
            await queryRunner.query(`ALTER TABLE campaign MODIFY COLUMN video VARCHAR(255) NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE campaign DROP COLUMN video`);
    }

}
