import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeCampaignFieldsNullable1744361779343 implements MigrationInterface {
    name = 'MakeCampaignFieldsNullable1744361779343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`campaign\` MODIFY \`description\` longtext NULL`);
        await queryRunner.query(`ALTER TABLE \`campaign\` MODIFY \`date_start\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`campaign\` MODIFY \`date_end\` datetime NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`campaign\` MODIFY \`description\` longtext NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`campaign\` MODIFY \`date_start\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`campaign\` MODIFY \`date_end\` datetime NOT NULL`);
    }
}
