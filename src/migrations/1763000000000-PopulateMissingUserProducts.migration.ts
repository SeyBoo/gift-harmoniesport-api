import { MigrationInterface, QueryRunner } from "typeorm";

export class PopulateMissingUserProducts1763000000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('Starting migration to populate missing user_product records...');

        // Find all orders that have items in the JSON field
        const orders = await queryRunner.query(`
            SELECT
                o.id as order_id,
                o.user_id,
                o.items
            FROM \`order\` o
            WHERE o.items IS NOT NULL
                AND JSON_LENGTH(o.items) > 0
                AND o.status = 'succeeded'
        `);

        console.log(`Found ${orders.length} orders with items`);

        let processedCount = 0;
        let createdCount = 0;

        for (const order of orders) {
            // Handle both string and object types
            let items;
            if (typeof order.items === 'string') {
                try {
                    items = JSON.parse(order.items);
                } catch (e) {
                    console.log(`Failed to parse items for order ${order.order_id}: ${e.message}`);
                    continue;
                }
            } else if (typeof order.items === 'object' && order.items !== null) {
                items = order.items;
            } else {
                console.log(`Invalid items type for order ${order.order_id}`);
                continue;
            }

            for (const item of items) {
                const productId = parseInt(item.productId);

                if (isNaN(productId)) {
                    console.log(`Skipping invalid productId: ${item.productId} for order ${order.order_id}`);
                    continue;
                }

                // Check if a user_product record already exists for this order and product
                const existingUserProduct = await queryRunner.query(`
                    SELECT id
                    FROM user_product
                    WHERE order_id = ? AND product_id = ?
                    LIMIT 1
                `, [order.order_id, productId]);

                if (existingUserProduct.length === 0) {
                    // Generate a unique token_id (similar to Web3 token format)
                    const tokenId = `order-${order.order_id}-product-${productId}-${Date.now()}`;

                    try {
                        // Create the missing user_product record
                        await queryRunner.query(`
                            INSERT INTO user_product (user_id, product_id, order_id, token_id, created_at, updated_at)
                            VALUES (?, ?, ?, ?, NOW(), NOW())
                        `, [order.user_id, productId, order.order_id, tokenId]);

                        createdCount++;
                        console.log(`Created user_product for order ${order.order_id}, product ${productId}`);
                    } catch (error) {
                        console.error(`Failed to create user_product for order ${order.order_id}, product ${productId}:`, error.message);
                    }
                }
            }

            processedCount++;
            if (processedCount % 100 === 0) {
                console.log(`Processed ${processedCount}/${orders.length} orders...`);
            }
        }

        console.log(`Migration completed. Created ${createdCount} new user_product records from ${processedCount} orders.`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration creates data based on existing order.items
        // Rolling back would delete legitimate records, so we'll skip the down migration
        console.log('Down migration not implemented - user_product records should not be automatically deleted');
    }

}
