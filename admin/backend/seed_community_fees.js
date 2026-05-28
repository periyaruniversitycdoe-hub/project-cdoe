/**
 * Seed script: Insert all 10 community fee records into community_fees table.
 * Run: node seed_community_fees.js
 */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const communities = [
  { community: 'OC',                  pg_min_mark: 55, fee_general: 1000, fee_diff_abled: 500, sort_order: 1 },
  { community: 'BC',                  pg_min_mark: 55, fee_general: 1000, fee_diff_abled: 500, sort_order: 2 },
  { community: 'BC(Muslim)',          pg_min_mark: 55, fee_general: 1000, fee_diff_abled: 500, sort_order: 3 },
  { community: 'MBC',                 pg_min_mark: 55, fee_general: 1000, fee_diff_abled: 500, sort_order: 4 },
  { community: 'DNC',                 pg_min_mark: 55, fee_general: 1000, fee_diff_abled: 500, sort_order: 5 },
  { community: 'OBC',                 pg_min_mark: null, fee_general: null, fee_diff_abled: null, sort_order: 6 },
  { community: 'OBC - Non Creamy Layer', pg_min_mark: null, fee_general: null, fee_diff_abled: null, sort_order: 7 },
  { community: 'SC',                  pg_min_mark: 50, fee_general: 500,  fee_diff_abled: 500, sort_order: 8 },
  { community: 'SC(A)',               pg_min_mark: 50, fee_general: 500,  fee_diff_abled: 500, sort_order: 9 },
  { community: 'ST',                  pg_min_mark: 50, fee_general: 500,  fee_diff_abled: 500, sort_order: 10 },
];

async function seed() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    // Create table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS community_fees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        community VARCHAR(100) NOT NULL UNIQUE,
        pg_min_mark DECIMAL(5,2) DEFAULT NULL,
        fee_general DECIMAL(10,2) DEFAULT NULL,
        fee_diff_abled DECIMAL(10,2) DEFAULT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Table community_fees is ready.');

    // Clear existing data (optional — comment out if you want to keep existing)
    await pool.execute('DELETE FROM community_fees');
    console.log('🗑️  Cleared existing records.');

    // Insert all communities
    for (const c of communities) {
      await pool.execute(
        'INSERT INTO community_fees (community, pg_min_mark, fee_general, fee_diff_abled, sort_order) VALUES (?, ?, ?, ?, ?)',
        [c.community, c.pg_min_mark, c.fee_general, c.fee_diff_abled, c.sort_order]
      );
      console.log(`  ✔ Inserted: ${c.community}`);
    }

    console.log('\n🎉 All 10 community fee records seeded successfully!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
