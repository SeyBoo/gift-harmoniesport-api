import { MigrationInterface, QueryRunner } from "typeorm";

export class AddThematicToCampaign1744704414245 implements MigrationInterface {
    name = 'AddThematicToCampaign1744704414245';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('campaign', 'thematic_id');
        if (!hasColumn) {
            await queryRunner.query(`ALTER TABLE \`campaign\` ADD \`thematic_id\` int NULL`);
            await queryRunner.query(`ALTER TABLE \`campaign\` ADD CONSTRAINT \`FK_campaign_thematic\` FOREIGN KEY (\`thematic_id\`) REFERENCES \`thematic\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasColumn = await queryRunner.hasColumn('campaign', 'thematic_id');
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE \`campaign\` DROP FOREIGN KEY \`FK_campaign_thematic\``);
            await queryRunner.query(`ALTER TABLE \`campaign\` DROP COLUMN \`thematic_id\``);
        }
    }
}
