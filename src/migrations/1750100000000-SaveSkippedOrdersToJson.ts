import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

// Define the enum directly in the migration file instead of importing it
enum PAYMENT_STATUS {
  INTENDED = 'intended',
  FAILED = 'FAILED',
  SUCCEEDED = 'succeeded',
  REFUNDED = 'refunded',
}

export class SaveSkippedOrdersToJson1750100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Get all successful orders that don't have transactions
    const skippedOrders = await queryRunner.query(`
      SELECT 
        o.id, 
        o.price, 
        o.bundles,
        o.status,
        o.created_at,
        p.id as product_id,
        p.name as product_name, 
        c.id as campaign_id,
        c.campagne_name as campaign_name,
        c.user_id as association_id,
        u.name_association as association_name,
        u.email as association_email
      FROM \`order\` o
      LEFT JOIN product p ON o.product_id = p.id
      LEFT JOIN campaign c ON p.campaign_id = c.id
      LEFT JOIN user u ON c.user_id = u.id
      WHERE o.status = '${PAYMENT_STATUS.SUCCEEDED}'
      AND NOT EXISTS (
        SELECT 1 FROM transaction t WHERE t.order_id = o.id
      )
    `);

    console.log(`Found ${skippedOrders.length} orders without transactions for analysis`);

    // Process each order to add analysis information
    const ordersWithAnalysis = skippedOrders.map(order => {
      let skipReason = [];
      let bundleInfo = null;
      let isDigital = false;

      // Check association
      if (!order.association_id) {
        skipReason.push('Missing association_id');
      }

      // Check price
      if (!order.price || isNaN(parseFloat(order.price)) || parseFloat(order.price) <= 0) {
        skipReason.push('Invalid price');
      }

      // Check bundles
      if (order.bundles) {
        try {
          if (typeof order.bundles === 'string') {
            bundleInfo = JSON.parse(order.bundles);
          } else if (Array.isArray(order.bundles)) {
            bundleInfo = order.bundles;
          } else if (typeof order.bundles === 'object') {
            bundleInfo = [order.bundles];
          }
          
          if (Array.isArray(bundleInfo)) {
            isDigital = bundleInfo.some(bundle => bundle.id === 'bundle-digital');
          }
        } catch (error) {
          skipReason.push(`Bundle parse error: ${error.message}`);
        }
      } else {
        skipReason.push('Missing bundles data');
      }

      // Format date for better readability
      let formattedDate = order.created_at;
      if (order.created_at instanceof Date) {
        formattedDate = order.created_at.toISOString();
      }

      return {
        ...order,
        created_at: formattedDate,
        bundle_data: bundleInfo,
        is_digital: isDigital,
        skip_reason: skipReason.length > 0 ? skipReason : ['Unknown'],
        recommended_action: skipReason.length > 0 
          ? 'Manual review needed' 
          : 'Could be migrated with fixed script'
      };
    });

    // Categorize orders
    const noAssociationOrders = ordersWithAnalysis.filter(o => o.skip_reason.includes('Missing association_id'));
    const invalidPriceOrders = ordersWithAnalysis.filter(o => o.skip_reason.includes('Invalid price'));
    const missingBundlesOrders = ordersWithAnalysis.filter(o => o.skip_reason.includes('Missing bundles data'));
    const bundleParseErrorOrders = ordersWithAnalysis.filter(o => o.skip_reason.some(r => r.includes('Bundle parse error')));
    const unknownIssueOrders = ordersWithAnalysis.filter(o => o.skip_reason.includes('Unknown'));

    // Create report data
    const reportData = {
      total_skipped_orders: skippedOrders.length,
      categories: {
        missing_association: {
          count: noAssociationOrders.length,
          orders: noAssociationOrders
        },
        invalid_price: {
          count: invalidPriceOrders.length,
          orders: invalidPriceOrders
        },
        missing_bundles: {
          count: missingBundlesOrders.length,
          orders: missingBundlesOrders
        },
        bundle_parse_errors: {
          count: bundleParseErrorOrders.length,
          orders: bundleParseErrorOrders
        },
        unknown_issues: {
          count: unknownIssueOrders.length,
          orders: unknownIssueOrders
        }
      },
      all_orders: ordersWithAnalysis
    };

    // Save the data to a JSON file
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(reportDir, `skipped-orders-${timestamp}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
    
    console.log(`Skipped orders report saved to: ${filePath}`);
  }

  public async down(): Promise<void> {
    // No need to do anything in down migration as we're just generating a report
    console.log('This migration only generates a report and does not modify the database.');
  }
} 