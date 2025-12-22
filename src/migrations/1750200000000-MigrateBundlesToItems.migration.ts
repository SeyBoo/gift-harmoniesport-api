import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateBundlesToItems1750200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Starting migration: Bundles to Items');

    // Step 1: Add the new 'items' column
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      ADD COLUMN \`items\` JSON NULL AFTER \`price\`
    `);

    // Step 2: Migrate data from bundles to items format
    const orders = await queryRunner.query(`
      SELECT id, bundles, product_id 
      FROM \`order\` 
      WHERE bundles IS NOT NULL
    `);

    console.log(`Found ${orders.length} orders with bundles to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const order of orders) {
      try {
        let bundlesData = order.bundles;
        
        // Parse bundles if it's a string
        if (typeof bundlesData === 'string') {
          bundlesData = JSON.parse(bundlesData);
        }

        // Ensure it's an array
        if (!Array.isArray(bundlesData)) {
          bundlesData = [bundlesData];
        }

        // Transform BundleItemWithPrice[] to OrderItem[]
        const items = bundlesData.map((bundle: any) => ({
          productId: order.product_id?.toString() || bundle.productId || '',
          quantity: bundle.quantity || 1,
          unitPrice: (bundle.price || 0).toString(),
          totalPrice: ((bundle.price || 0) * (bundle.quantity || 1)).toString(),
          productType: bundle.productType || this.mapBundleIdToProductType(bundle.id),
        }));

        // Update the order with the new items format
        await queryRunner.query(
          `UPDATE \`order\` SET items = ? WHERE id = ?`,
          [JSON.stringify(items), order.id]
        );

        migratedCount++;

        if (migratedCount % 100 === 0) {
          console.log(`Migrated ${migratedCount} orders...`);
        }
      } catch (error) {
        console.log(`Failed to migrate order ${order.id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`Migration completed: ${migratedCount} orders migrated, ${skippedCount} skipped`);

    // Step 3: Drop the old bundles column
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      DROP COLUMN \`bundles\`
    `);

    // Step 4: Drop the product foreign key constraint and column
    // First, find the foreign key constraint name
    const foreignKeys = await queryRunner.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'order' 
        AND COLUMN_NAME = 'product_id' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    if (foreignKeys.length > 0) {
      const constraintName = foreignKeys[0].CONSTRAINT_NAME;
      await queryRunner.query(
        `ALTER TABLE \`order\` DROP FOREIGN KEY \`${constraintName}\``
      );
    }

    // Drop the product_id column
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      DROP COLUMN \`product_id\`
    `);

    console.log('Migration completed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back migration: Items to Bundles');

    // Step 1: Add back the product_id column
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      ADD COLUMN \`product_id\` INT NULL
    `);

    // Step 2: Add back the bundles column
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      ADD COLUMN \`bundles\` JSON NULL AFTER \`price\`
    `);

    // Step 3: Migrate data back from items to bundles format
    const orders = await queryRunner.query(`
      SELECT id, items 
      FROM \`order\` 
      WHERE items IS NOT NULL
    `);

    console.log(`Found ${orders.length} orders with items to rollback`);

    for (const order of orders) {
      try {
        let itemsData = order.items;
        
        if (typeof itemsData === 'string') {
          itemsData = JSON.parse(itemsData);
        }

        if (!Array.isArray(itemsData)) {
          itemsData = [itemsData];
        }

        // Transform OrderItem[] back to BundleItemWithPrice[]
        const bundles = itemsData.map((item: any) => ({
          id: this.mapProductTypeToBundleId(item.productType),
          quantity: parseInt(item.quantity?.toString() || '1'),
          price: parseFloat(item.unitPrice || '0'),
        }));

        // Update the order with the old bundles format
        await queryRunner.query(
          `UPDATE \`order\` SET bundles = ?, product_id = ? WHERE id = ?`,
          [JSON.stringify(bundles), parseInt(itemsData[0]?.productId) || null, order.id]
        );
      } catch (error) {
        console.log(`Failed to rollback order ${order.id}: ${error.message}`);
      }
    }

    // Step 4: Drop the items column
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      DROP COLUMN \`items\`
    `);

    // Step 5: Re-add the foreign key constraint
    await queryRunner.query(`
      ALTER TABLE \`order\` 
      ADD CONSTRAINT \`FK_order_product\` 
      FOREIGN KEY (\`product_id\`) REFERENCES \`product\`(\`id\`)
    `);

    console.log('Rollback completed successfully');
  }

  private mapBundleIdToProductType(bundleId: string): 'magnet' | 'digital' | 'collector' {
    switch (bundleId) {
      case 'bundle-digital':
        return 'digital';
      case 'bundle-premium':
        return 'collector';
      case 'bundle-plus':
      case 'bundle-basic':
      default:
        return 'magnet';
    }
  }

  private mapProductTypeToBundleId(productType: string): string {
    switch (productType) {
      case 'digital':
        return 'bundle-digital';
      case 'collector':
        return 'bundle-premium';
      case 'magnet':
      default:
        return 'bundle-basic';
    }
  }
} 