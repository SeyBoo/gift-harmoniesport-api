import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTagsToCampaign1744748020624 implements MigrationInterface {
    name = 'AddTagsToCampaign1744748020624';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('campaign', 'tags');
        if (!hasColumn) {
            await queryRunner.query(`ALTER TABLE \`campaign\` ADD \`tags\` text NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('campaign', 'tags');
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE \`campaign\` DROP COLUMN \`tags\``);
        }
    }
}
