import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailsTable1760000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE emails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        htmlBody TEXT,
        status ENUM('draft', 'sent', 'failed') NOT NULL DEFAULT 'draft',
        provider ENUM('email') NOT NULL DEFAULT 'email',
        recipients JSON NOT NULL,
        recipientCount INT NOT NULL DEFAULT 0,
        sentAt DATETIME,
        sendResult JSON,
        user_id INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT FK_emails_user_id FOREIGN KEY (user_id) REFERENCES user(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS emails`);
  }
}