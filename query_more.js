const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'zephyr.proxy.rlwy.net',
    port: 55838,
    user: 'root',
    password: 'ZbdDJZqLecMrVGLtgyFZqowsNpYJIunh',
    database: 'railway'
  });

  // Get all details of majeed74905 supervisor account
  const [sv] = await conn.execute(
    "SELECT su.id, su.name, su.email, su.mobile, su.status, s.department, s.specialization FROM supervisor_users su LEFT JOIN supervisors s ON su.supervisor_id = s.id WHERE su.email LIKE '%majeed%' OR su.email LIKE '%cdoe%' OR su.email LIKE '%periyar%'"
  );
  console.log("MAJEED/CDOE SUPERVISOR:", JSON.stringify(sv, null, 2));

  // Also check all supervisor users for cdoe pattern
  const [all] = await conn.execute("SELECT name, email, status FROM supervisor_users");
  console.log("ALL SUPERVISORS:", JSON.stringify(all, null, 2));

  await conn.end();
}
run().catch(e => console.error(e.message));
