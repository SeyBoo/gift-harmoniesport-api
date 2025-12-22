import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1739295812114 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE upload_session (
        id CHAR(36) PRIMARY KEY, -- Use CHAR(36) for UUID
        user_id INT NOT NULL,
        status ENUM('pending', 'in_progress', 'completed', 'failed', 'processing', 'uploaded') NOT NULL DEFAULT 'pending',
        total_files INT DEFAULT 0,
        processed_files INT DEFAULT 0,
        progress_percentage DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT FK_user_id FOREIGN KEY (user_id) REFERENCES user(id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE upload_item (
        id CHAR(36) PRIMARY KEY, -- Use CHAR(36) for UUID
        upload_session_id CHAR(36) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        image_url VARCHAR(255) DEFAULT NULL,
        slug VARCHAR(255) DEFAULT NULL,
        price FLOAT NOT NULL,
        status ENUM('pending', 'in_progress', 'completed', 'failed', 'processing', 'uploaded') NOT NULL DEFAULT 'pending',
        error_message TEXT DEFAULT NULL,
        retry_count INT DEFAULT 0,
        quantity INT DEFAULT 1,
        metadata JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT FK_upload_item_session FOREIGN KEY (upload_session_id) REFERENCES upload_session(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS upload_item`);
    await queryRunner.query(`DROP TABLE IF EXISTS upload_session`);
  }
}
