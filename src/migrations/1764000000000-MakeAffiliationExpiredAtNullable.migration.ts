import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeAffiliationExpiredAtNullable1764000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Make expired_at nullable to support permanent affiliations (for associations)
        await queryRunner.query(
            `ALTER TABLE \`user_affiliation\` MODIFY COLUMN \`expired_at\` datetime NULL`,
        );

        // Update existing association affiliations to have null expiry (making them permanent)
        // Associations have user_type_id = 1
        await queryRunner.query(`
            UPDATE user_affiliation ua
            INNER JOIN user u ON ua.affiliated_user_id = u.id
            SET ua.expired_at = NULL
            WHERE u.user_type_id = 1
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Set a default expiry date for null values before making the column non-nullable
        await queryRunner.query(`
            UPDATE user_affiliation
            SET expired_at = DATE_ADD(created_at, INTERVAL 1 YEAR)
            WHERE expired_at IS NULL
        `);

        // Make expired_at non-nullable again
        await queryRunner.query(
            `ALTER TABLE \`user_affiliation\` MODIFY COLUMN \`expired_at\` datetime NOT NULL`,
        );
    }

}
