import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateCampaignCelebritiesTable1723675200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'campaign_celebrities',
        columns: [
          {
            name: 'campaign_id',
            type: 'int',
            isPrimary: true,
          },
          {
            name: 'celebrity_id',
            type: 'int',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'campaign_celebrities',
      new TableForeignKey({
        columnNames: ['campaign_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'campaign',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'campaign_celebrities',
      new TableForeignKey({
        columnNames: ['celebrity_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'celebrity',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('campaign_celebrities');
    const foreignKey1 = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('campaign_id') !== -1,
    );
    const foreignKey2 = table.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('celebrity_id') !== -1,
    );
    await queryRunner.dropForeignKey('campaign_celebrities', foreignKey1);
    await queryRunner.dropForeignKey('campaign_celebrities', foreignKey2);
    await queryRunner.dropTable('campaign_celebrities');
  }
} 