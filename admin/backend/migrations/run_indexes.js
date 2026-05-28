/**
 * Run session-performance indexes against the live DB.
 * Each index is only created when it doesn't already exist.
 * Safe to re-run at any time.
 */
const pool = require('../config/db');

const INDEXES = [
  // applications: composite covering most admin filter combos
  { table: 'applications', name: 'idx_app_sess_status',  cols: 'session_id, status' },
  { table: 'applications', name: 'idx_app_sess_payment', cols: 'session_id, payment_status' },
  { table: 'applications', name: 'idx_app_sess_qual',    cols: 'session_id, qualification_status' },
  { table: 'applications', name: 'idx_app_sess_att',     cols: 'session_id, attendance_status' },
  { table: 'applications', name: 'idx_app_sess_adm',     cols: 'session_id, admission_approved' },
  { table: 'applications', name: 'idx_app_sess_created', cols: 'session_id, created_at' },
  // users
  { table: 'users', name: 'idx_users_sess_role', cols: 'session_id, role' },
  // counselling
  { table: 'counselling_applications',   name: 'idx_ca_sess_status', cols: 'session_id, status' },
  { table: 'counselling_research_choices', name: 'idx_crc_app',      cols: 'counselling_application_id' },
  { table: 'counselling_research_choices', name: 'idx_crc_sup',      cols: 'supervisor_id' },
];

async function main() {
  const conn = await pool.getConnection();
  const [[{ db }]] = await conn.execute('SELECT DATABASE() AS db');

  for (const { table, name, cols } of INDEXES) {
    const [[row]] = await conn.execute(
      `SELECT 1 FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1`,
      [db, table, name]
    );
    if (row) {
      console.log(`  SKIP  ${name} (already exists)`);
    } else {
      await conn.execute(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${cols})`);
      console.log(`  CREATE ${name} on ${table}(${cols})`);
    }
  }

  conn.release();
  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
