/**
 * Seed script: Insert all 10 community fee records into community_fees table.
 * Run: node seed_community_fees.js
 */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const communities = [
  { community_name: 'OC',                  pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 1 },
  { community_name: 'BC',                  pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 2 },
  { community_name: 'BC(Muslim)',          pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 3 },
  { community_name: 'MBC',                 pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 4 },
  { community_name: 'DNC',                 pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 5 },
  { community_name: 'OBC',                 pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 6 },
  { community_name: 'OBC - Non Creamy Layer', pg_min_mark: 55, general_fee: 1000, differently_abled_fee: 500, sort_order: 7 },
  { community_name: 'SC',                  pg_min_mark: 50, general_fee: 500,  differently_abled_fee: 500, sort_order: 8 },
  { community_name: 'SC(A)',               pg_min_mark: 50, general_fee: 500,  differently_abled_fee: 500, sort_order: 9 },
  { community_name: 'ST',                  pg_min_mark: 50, general_fee: 500,  differently_abled_fee: 500, sort_order: 10 },
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
        community_name VARCHAR(100) NOT NULL UNIQUE,
        pg_min_mark DECIMAL(5,2) DEFAULT NULL,
        general_fee DECIMAL(10,2) DEFAULT NULL,
        differently_abled_fee DECIMAL(10,2) DEFAULT NULL,
        roster_percentage DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'active',
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
        'INSERT INTO community_fees (community_name, pg_min_mark, general_fee, differently_abled_fee, sort_order) VALUES (?, ?, ?, ?, ?)',
        [c.community_name, c.pg_min_mark, c.general_fee, c.differently_abled_fee, c.sort_order]
      );
      console.log(`  ✔ Inserted: ${c.community_name}`);
    }

    console.log('\n🎉 All 10 community fee records seeded successfully!');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
