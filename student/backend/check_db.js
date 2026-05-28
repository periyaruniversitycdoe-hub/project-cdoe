const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'rsm_db'
});

db.connect(err => {
    if (err) { console.error('DB ERROR:', err.message); process.exit(1); }
    console.log('✅ Connected to rsm_db\n');
    runNext();
});

const checks = [
    'SHOW TABLES',
    'SELECT COUNT(*) as total FROM university_settings',
    'SELECT COUNT(*) as total FROM dropdown_exam_centers',
    'SELECT COUNT(*) as total FROM dropdown_subjects',
    'SELECT COUNT(*) as total FROM dropdown_categories',
    'SELECT COUNT(*) as total FROM dropdown_districts',
    'SELECT COUNT(*) as total FROM dropdown_genders',
    'SELECT COUNT(*) as total FROM dropdown_communities',
    'SELECT COUNT(*) as total FROM users',
    'SELECT * FROM university_settings',
    'SELECT * FROM dropdown_exam_centers',
    'SELECT * FROM dropdown_subjects',
    'SELECT * FROM dropdown_categories',
    'SELECT * FROM dropdown_districts',
];

let i = 0;
const runNext = () => {
    if (i >= checks.length) { db.end(); return; }
    const q = checks[i++];
    db.query(q, (err, res) => {
        if (err) { console.error(`❌ FAIL [${q}]: ${err.message}`); }
        else { console.log(`✅ ${q}`); console.table(res); }
        runNext();
    });
};

