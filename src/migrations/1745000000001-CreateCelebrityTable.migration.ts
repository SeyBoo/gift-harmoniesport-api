import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CreateCelebrityTable1745000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'celebrity',
      'jobTitle',
      new TableColumn({
        name: 'jobTitle',
        type: 'json',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'celebrity',
      'description',
      new TableColumn({
        name: 'description',
        type: 'json',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'celebrity',
      'imageUrl',
      new TableColumn({
        name: 'imageUrl',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'celebrity',
      'name',
      new TableColumn({
        name: 'name',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'celebrity',
      'associations',
      new TableColumn({
        name: 'associations',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'celebrity',
      'is_deleted',
      new TableColumn({
        name: 'is_deleted',
        type: 'boolean',
        isNullable: true,
        default: false,
      }),
    );

    // Add the new column 'is_confirmed'
    const table = await queryRunner.getTable('celebrity');
    if (!table.findColumnByName('is_confirmed')) {
      await queryRunner.addColumn(
        'celebrity',
        new TableColumn({
          name: 'is_confirmed',
          type: 'boolean',
          isNullable: false,
          default: true, // Set default to true
        }),
      );

      await queryRunner.query(`UPDATE celebrity SET is_confirmed = true`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('celebrity');
  }
}
