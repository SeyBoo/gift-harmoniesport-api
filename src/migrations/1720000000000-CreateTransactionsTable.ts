import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateTransactionsTable1720000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transaction',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'order_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'fees',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'net_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'association_id',
            type: 'int',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'is_payout',
            type: 'boolean',
            default: false,
          },
          {
            name: 'payout_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'completed'",
          },
        ],
      }),
      true,
    );

    // Foreign key to order table
    await queryRunner.createForeignKey(
      'transaction',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedTableName: 'order',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Foreign key to user table (association)
    await queryRunner.createForeignKey(
      'transaction',
      new TableForeignKey({
        columnNames: ['association_id'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('transaction');
    const orderForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('order_id') !== -1,
    );
    const associationForeignKey = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('association_id') !== -1,
    );
    
    await queryRunner.dropForeignKey('transaction', orderForeignKey);
    await queryRunner.dropForeignKey('transaction', associationForeignKey);
    
    // Then drop the table
    await queryRunner.dropTable('transaction');
  }
} 