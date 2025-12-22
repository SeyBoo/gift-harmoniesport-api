import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds the 'deleted' column to the 'campaign' table.
 */
export class AddDeletedColumnToCampaign1680000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'campaign',
      new TableColumn({
        name: 'deleted',
        type: 'boolean',
        isNullable: true,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('campaign', 'deleted');
  }
}