import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPromotionFieldsToCampaign1763000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add promotion_active column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` ADD \`promotion_active\` tinyint(1) NULL DEFAULT 0`,
        );

        // Add promotion_type column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` ADD \`promotion_type\` enum('percentage', 'fixed') NULL`,
        );

        // Add promotion_value column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` ADD \`promotion_value\` decimal(10,2) NULL`,
        );

        // Add promotion_start_date column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` ADD \`promotion_start_date\` datetime NULL`,
        );

        // Add promotion_end_date column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` ADD \`promotion_end_date\` datetime NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove promotion_end_date column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` DROP COLUMN \`promotion_end_date\``,
        );

        // Remove promotion_start_date column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` DROP COLUMN \`promotion_start_date\``,
        );

        // Remove promotion_value column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` DROP COLUMN \`promotion_value\``,
        );

        // Remove promotion_type column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` DROP COLUMN \`promotion_type\``,
        );

        // Remove promotion_active column
        await queryRunner.query(
            `ALTER TABLE \`campaign\` DROP COLUMN \`promotion_active\``,
        );
    }

}
