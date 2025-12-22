import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampsToCampaign1745232828000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('campaign');
        
        const createdAtColumn = table.findColumnByName('created_at');
        if (!createdAtColumn) {
            await queryRunner.query(`ALTER TABLE campaign ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`);
        } else {
            await queryRunner.query(`ALTER TABLE campaign MODIFY COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP`);
        }

        const updatedAtColumn = table.findColumnByName('updated_at');
        if (!updatedAtColumn) {
            await queryRunner.query(`ALTER TABLE campaign ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        } else {
            await queryRunner.query(`ALTER TABLE campaign MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE campaign DROP COLUMN updated_at`);
        await queryRunner.query(`ALTER TABLE campaign DROP COLUMN created_at`);
    }

} 