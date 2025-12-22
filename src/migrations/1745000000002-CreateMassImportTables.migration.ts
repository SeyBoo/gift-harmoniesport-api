import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateMassImportTables1745000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'mass_import_session',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'in_progress', 'completed', 'failed', 'processing', 'uploaded'],
            default: "'pending'",
          },
          {
            name: 'total_items',
            type: 'int',
            default: 0,
          },
          {
            name: 'processed_items',
            type: 'int',
            default: 0,
          },
          {
            name: 'progress_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'session_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'mass_import_item',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'mass_import_session_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'index',
            type: 'int',
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'player_number',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'player_face',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'season',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'variant',
            type: 'json',
          },
          {
            name: 'image_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'image_position',
            type: 'json',
          },
          {
            name: 'image_scale',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'image_rotation',
            type: 'decimal',
            precision: 5,
            scale: 2,
          },
          {
            name: 'card_design',
            type: 'int',
          },
          {
            name: 'text_position',
            type: 'json',
          },
          {
            name: 'first_name_size',
            type: 'int',
          },
          {
            name: 'last_name_size',
            type: 'int',
          },
          {
            name: 'text_gap',
            type: 'int',
          },
          {
            name: 'ai_check',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'ready', 'completed', 'error'],
            default: "'pending'",
          },
          {
            name: 'reviewed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'mass_import_session',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'mass_import_item',
      new TableForeignKey({
        columnNames: ['mass_import_session_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'mass_import_session',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('mass_import_item');
    await queryRunner.dropTable('mass_import_session');
  }
}
