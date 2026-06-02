const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const mysql = require('mysql2/promise');

// Resolve the root directory
const rootDir = path.resolve(__dirname, '../..');

// Load environment variables from the root .env file
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ Loaded environment configuration from .env');
} else {
  console.error('❌ Error: .env file not found at:', envPath);
  process.exit(1);
}

// List of migrations and seeds in order of execution
const scripts = [
  // 1. Initial settings and schemas
  { name: 'update_settings_schema.js', path: path.join(rootDir, 'student/backend/update_settings_schema.js'), cwd: path.join(rootDir, 'student/backend') },
  { name: 'migrate_online_app.js', path: path.join(rootDir, 'student/backend/migrate_online_app.js'), cwd: path.join(rootDir, 'student/backend') },
  
  // 2. Migration scripts under database/migrations
  { name: 'create_otp_table.js', path: path.join(rootDir, 'database/migrations/create_otp_table.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_integrated_migration.js', path: path.join(rootDir, 'database/migrations/apply_integrated_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_central_upload_migration.js', path: path.join(rootDir, 'database/migrations/apply_central_upload_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_community_consolidation.js', path: path.join(rootDir, 'database/migrations/apply_community_consolidation.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_designation_consolidation.js', path: path.join(rootDir, 'database/migrations/apply_designation_consolidation.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_home_address_migration.js', path: path.join(rootDir, 'database/migrations/apply_home_address_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_pt_migration.js', path: path.join(rootDir, 'database/migrations/apply_pt_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'apply_pt_names_migration.js', path: path.join(rootDir, 'database/migrations/apply_pt_names_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  
  // 3. Part-time master data seeding
  { name: 'insert_pt_master_data.js', path: path.join(rootDir, 'scripts/insert_pt_master_data.js'), cwd: path.join(rootDir, 'scripts') },
  
  // 4. District and eligibility seeding (must be after part-time master seeding)
  { name: '007_eligibility_seed.js', path: path.join(rootDir, 'database/migrations/007_eligibility_seed.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: '008_seed_districts.js', path: path.join(rootDir, 'database/migrations/008_seed_districts.js'), cwd: path.join(rootDir, 'database/migrations') },
  
  // 5. Supervisor and centre updates
  { name: 'supervisor_hotfix_migration.js', path: path.join(rootDir, 'database/migrations/supervisor_hotfix_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'supervisor_specialization_migration.js', path: path.join(rootDir, 'database/migrations/supervisor_specialization_migration.js'), cwd: path.join(rootDir, 'database/migrations') },
  { name: 'migrate_approval_workflow.js', path: path.join(rootDir, 'scripts/migrate_approval_workflow.js'), cwd: path.join(rootDir, 'scripts') },
  { name: 'update_centre_status_enum.js', path: path.join(rootDir, 'database/migrations/update_centre_status_enum.js'), cwd: path.join(rootDir, 'database/migrations') },
  
  // 6. News and announcements seeding
  { name: 'seed_news_announcements.js', path: path.join(rootDir, 'scripts/seed_news_announcements.js'), cwd: path.join(rootDir, 'scripts') }
];

function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n==================================================`);
    console.log(`🚀 RUNNING: ${script.name}`);
    console.log(`📂 Path: ${script.path}`);
    console.log(`==================================================`);

    if (!fs.existsSync(script.path)) {
      return reject(new Error(`File not found: ${script.path}`));
    }

    const child = fork(script.path, [], { cwd: script.cwd });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ SUCCESS: ${script.name} completed successfully.`);
        resolve();
      } else {
        console.error(`❌ FAILED: ${script.name} exited with code ${code}.`);
        reject(new Error(`${script.name} failed.`));
      }
    });

    child.on('error', (err) => {
      console.error(`❌ ERROR: Failed to start ${script.name}:`, err.message);
      reject(err);
    });
  });
}

async function verifyFinalDatabaseState() {
  console.log(`\n==================================================`);
  console.log(`📊 VERIFYING FINAL DATABASE STATE`);
  console.log(`==================================================`);

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rsm_db',
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // 1. Verify community_fees table schema & rows
    const [cfCols] = await connection.query('SHOW COLUMNS FROM community_fees');
    const cfFields = cfCols.map(c => c.Field);
    console.log(`🔹 community_fees columns: ${cfFields.join(', ')}`);
    const [[cfCount]] = await connection.query('SELECT COUNT(*) as cnt FROM community_fees');
    console.log(`   Row count: ${cfCount.cnt}`);

    // 2. Verify master_designations columns
    const [mdCols] = await connection.query('SHOW COLUMNS FROM master_designations');
    const mdFields = mdCols.map(c => c.Field);
    console.log(`🔹 master_designations columns: ${mdFields.join(', ')}`);
    const [mdRows] = await connection.query('SELECT name, max_capacity FROM master_designations');
    console.table(mdRows);

    // 3. Verify file_upload_settings columns
    const [fusCols] = await connection.query('SHOW COLUMNS FROM file_upload_settings');
    const fusFields = fusCols.map(c => c.Field);
    console.log(`🔹 file_upload_settings columns: ${fusFields.join(', ')}`);

    // 4. Verify research_centres status enum
    const [rcCols] = await connection.query('SHOW COLUMNS FROM research_centres LIKE "status"');
    console.log(`🔹 research_centres status type: ${rcCols[0]?.Type}`);

    // 5. Verify news_announcements count
    const [[naCount]] = await connection.query('SELECT COUNT(*) as cnt FROM news_announcements');
    console.log(`🔹 news_announcements row count: ${naCount.cnt}`);

    console.log('\n🎉 ALL DATABASE VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Database verification failed:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function main() {
  const startTime = Date.now();
  console.log('🏁 Starting database migrations and seeds execution runner...');

  try {
    for (const script of scripts) {
      await runScript(script);
    }
    console.log('\n✨ All migrations and seeds run successfully!');
    
    // Verify the database state
    await verifyFinalDatabaseState();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🏁 Master execution runner finished in ${duration}s.`);
  } catch (err) {
    console.error('\n❌ Execution stopped due to migration failure:', err.message);
    process.exit(1);
  }
}

main();
