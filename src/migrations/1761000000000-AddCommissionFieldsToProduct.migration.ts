import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommissionFieldsToProduct1761000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add commission_type column
        await queryRunner.query(
            `ALTER TABLE \`product\` ADD \`commission_type\` enum('percentage', 'fixed') NULL DEFAULT 'fixed'`,
        );

        // Add commission_value column
        await queryRunner.query(
            `ALTER TABLE \`product\` ADD \`commission_value\` decimal(10,2) NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove commission_value column
        await queryRunner.query(
            `ALTER TABLE \`product\` DROP COLUMN \`commission_value\``,
        );

        // Remove commission_type column
        await queryRunner.query(
            `ALTER TABLE \`product\` DROP COLUMN \`commission_type\``,
        );
    }

}
