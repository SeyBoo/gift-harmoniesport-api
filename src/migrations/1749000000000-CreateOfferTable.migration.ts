import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateOfferTable1749000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'offer',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'email',
            type: 'varchar',
          },
          {
            name: 'verify_token',
            type: 'varchar',
          },
          {
            name: 'productId',
            type: 'int',
          },
          {
            name: 'claimed_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'sent_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'bounced',
            type: 'boolean',
            default: false,
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
      'offer',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'product',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('offer');
    const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('productId') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('offer', foreignKey);
    }
    await queryRunner.dropTable('offer');
  }
} 