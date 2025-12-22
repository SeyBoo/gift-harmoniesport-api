import { MigrationInterface, QueryRunner } from 'typeorm';

// Define the enum directly in the migration file instead of importing it
enum PAYMENT_STATUS {
  INTENDED = 'intended',
  FAILED = 'FAILED',
  SUCCEEDED = 'succeeded',
  REFUNDED = 'refunded',
}

export class MigrateSuccessfulOrdersToTransactions1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Get all successful orders with their product and campaign information
    const successfulOrders = await queryRunner.query(`
      SELECT 
        o.id, 
        o.price, 
        o.bundles,
        p.id as product_id, 
        c.user_id as association_id, 
        o.created_at, 
        o.status
      FROM \`order\` o
      JOIN product p ON o.product_id = p.id
      JOIN campaign c ON p.campaign_id = c.id
      WHERE o.status = '${PAYMENT_STATUS.SUCCEEDED}'
      AND NOT EXISTS (
        SELECT 1 FROM transaction t WHERE t.order_id = o.id
      )
    `);

    // Log the number of orders found
    console.log(`Found ${successfulOrders.length} successful orders to migrate to transactions`);

    let migratedCount = 0;
    let skippedCount = 0;
    let digitalCount = 0;
    let physicalCount = 0;
    let ordersWithNoBundles = 0;

    // Log a few samples of bundles to debug
    console.log('Sampling some bundles from orders:');
    for (let i = 0; i < Math.min(5, successfulOrders.length); i++) {
      console.log(`Order ${successfulOrders[i].id} bundles: ${successfulOrders[i].bundles}`);
    }

    // 2. For each order, create a transaction record
    for (const order of successfulOrders) {
      if (!order.association_id) {
        console.log(`Skipping order ${order.id} because association_id is null`);
        skippedCount++;
        continue;
      }

      // Calculate transaction details
      // Try to get the price from the order
      let amount = 0;
      let isDigital = false;
      
      // First try to get from price field
      if (order.price && !isNaN(parseFloat(order.price))) {
        amount = parseFloat(order.price);
      } 
      
      // Then try to calculate from bundles if available
      if (order.bundles) {
        try {
          // Check if bundles is a string that needs parsing
          let bundlesArray = [];
          if (typeof order.bundles === 'string') {
            bundlesArray = JSON.parse(order.bundles);
          } else if (Array.isArray(order.bundles)) {
            bundlesArray = order.bundles;
          } else if (typeof order.bundles === 'object') {
            bundlesArray = [order.bundles];
          }
          
          // If amount is still 0, calculate from bundles
          if (amount === 0 && Array.isArray(bundlesArray)) {
            amount = bundlesArray.reduce((sum, bundle) => {
              return sum + (parseFloat(bundle.price) || 0);
            }, 0);
          }
          
          // Check if any bundle item is digital by id being 'bundle-digital'
          if (Array.isArray(bundlesArray)) {
            isDigital = bundlesArray.some(bundle => {
              const isDigitalBundle = bundle.id === 'bundle-digital';
              if (isDigitalBundle) {
                console.log(`Found digital bundle in order ${order.id}: ${JSON.stringify(bundle)}`);
              }
              return isDigitalBundle;
            });
          }
        } catch (error) {
          console.log(`Error processing bundles for order ${order.id}: ${error.message}`);
          console.log(`Raw bundles value: ${JSON.stringify(order.bundles)}`);
        }
      } else {
        ordersWithNoBundles++;
        console.log(`Order ${order.id} has no bundles information`);
      }
      
      if (amount <= 0) {
        console.log(`Skipping order ${order.id} because calculated amount is invalid: ${amount}`);
        skippedCount++;
        continue;
      }
      
      // Calculate fees based on product type
      // 20% for digital products, 35% for physical products
      const feePercentage = isDigital ? 0.2 : 0.35;
      const fees = amount * feePercentage;
      const netAmount = amount - fees;

      if (isDigital) {
        digitalCount++;
      } else {
        physicalCount++;
      }

      // Format the date properly for MySQL
      let createdAtFormatted = order.created_at;
      if (order.created_at instanceof Date) {
        createdAtFormatted = order.created_at.toISOString().slice(0, 19).replace('T', ' ');
      }

      try {
        // Insert transaction record with parameterized query
        await queryRunner.query(
          `INSERT INTO transaction (
            order_id, 
            amount, 
            fees, 
            net_amount, 
            association_id, 
            created_at, 
            is_payout, 
            status
          ) VALUES (?, ?, ?, ?, ?, ?, FALSE, 'completed')`,
          [
            order.id,
            amount.toFixed(2),
            fees.toFixed(2),
            netAmount.toFixed(2),
            order.association_id,
            createdAtFormatted,
          ]
        );
        migratedCount++;
      } catch (error) {
        console.log(`Error inserting transaction for order ${order.id}: ${error.message}`);
        skippedCount++;
      }
    }

    console.log(`Migration summary:
      - Total orders found: ${successfulOrders.length}
      - Successfully migrated: ${migratedCount}
      - Skipped: ${skippedCount}
      - Digital products: ${digitalCount}
      - Physical products: ${physicalCount}
      - Orders with no bundles: ${ordersWithNoBundles}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove transactions created from orders
    const result = await queryRunner.query(`
      DELETE FROM transaction
      WHERE order_id IS NOT NULL
    `);
    
    console.log(`Rolled back order transaction migration, deleted ${result.affectedRows} transactions`);
  }
} 