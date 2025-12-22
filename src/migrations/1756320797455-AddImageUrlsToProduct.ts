import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImageUrlsToProduct1756320797455 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add collector_image_url column
        await queryRunner.query(
            `ALTER TABLE \`product\` ADD \`collector_image_url\` varchar(255) NULL`,
        );
        
        // Add digital_image_url column
        await queryRunner.query(
            `ALTER TABLE \`product\` ADD \`digital_image_url\` varchar(255) NULL`,
        );
        
        // Add magnet_image_url column
        await queryRunner.query(
            `ALTER TABLE \`product\` ADD \`magnet_image_url\` varchar(255) NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove magnet_image_url column
        await queryRunner.query(
            `ALTER TABLE \`product\` DROP COLUMN \`magnet_image_url\``,
        );
        
        // Remove digital_image_url column
        await queryRunner.query(
            `ALTER TABLE \`product\` DROP COLUMN \`digital_image_url\``,
        );
        
        // Remove collector_image_url column
        await queryRunner.query(
            `ALTER TABLE \`product\` DROP COLUMN \`collector_image_url\``,
        );
    }

}
