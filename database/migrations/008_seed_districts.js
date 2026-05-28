/**
 * Migration 008 — Seed Real-Time Districts for Tamil Nadu & Karnataka (Bangalore)
 *
 * What this script does (idempotent — safe to run multiple times):
 *  1. Seeds all 38 Tamil Nadu districts under every existing "Tamil Nadu" working-area entry.
 *  2. Adds "Karnataka (Bangalore)" as a working area under every role that already has
 *     "Tamil Nadu" as an area (matching the same university-jurisdiction logic).
 *  3. Seeds all 31 Karnataka districts under every newly created / already-existing
 *     "Karnataka (Bangalore)" area entry.
 *
 * Run: node database/migrations/008_seed_districts.js
 */

const path = require('path');
// Resolve deps from student/backend which houses node_modules
const nmRoot = path.join(__dirname, '../../student/backend/node_modules');
require(path.join(nmRoot, 'dotenv')).config({ path: path.join(__dirname, '../../.env') });
const mysql = require(path.join(nmRoot, 'mysql2/promise'));

// ── District master data ──────────────────────────────────────────────────────

const TN_DISTRICTS = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
    'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram',
    'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
    'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai',
    'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
    'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
    'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur',
    'Vellore', 'Viluppuram', 'Virudhunagar'
];

const KA_DISTRICTS = [
    'Bagalkot', 'Ballari (Bellary)', 'Belagavi (Belgaum)',
    'Bengaluru Rural', 'Bengaluru Urban (Bangalore City)',
    'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru',
    'Chitradurga', 'Dakshina Kannada', 'Davanagere', 'Dharwad',
    'Gadag', 'Hassan', 'Haveri', 'Kalaburagi (Gulbarga)',
    'Kodagu', 'Kolar', 'Koppal', 'Mandya',
    'Mysuru (Mysore)', 'Raichur', 'Ramanagara',
    'Shivamogga (Shimoga)', 'Tumakuru (Tumkur)', 'Udupi',
    'Uttara Kannada', 'Vijayanagara', 'Vijayapura (Bijapur)', 'Yadgir'
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedDistricts(db, areaId, areaName, districts) {
    let inserted = 0;
    let skipped  = 0;
    for (const d of districts) {
        try {
            await db.query(
                'INSERT INTO part_time_area_districts (area_id, district_name, status) VALUES (?, ?, 1)',
                [areaId, d]
            );
            inserted++;
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                skipped++;
            } else {
                throw err;
            }
        }
    }
    console.log(`   ✅ ${areaName} (area_id=${areaId}): ${inserted} inserted, ${skipped} already existed`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
    const db = await mysql.createPool({
        host:     process.env.DB_HOST     || 'localhost',
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'rsm_db',
        charset:  'utf8mb4',
    });

    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  Migration 008 — Tamil Nadu & Karnataka District Seeder');
        console.log('═══════════════════════════════════════════════════════════\n');

        // ── STEP 1: Tamil Nadu districts ──────────────────────────────────────
        console.log('📌 STEP 1: Seeding Tamil Nadu districts…');
        const [tnAreas] = await db.query(
            "SELECT id, eligible_area_name FROM part_time_eligible_areas WHERE eligible_area_name = 'Tamil Nadu'"
        );

        if (tnAreas.length === 0) {
            console.log('   ⚠️  No "Tamil Nadu" working areas found in the database.');
            console.log('      (Admin must first add Tamil Nadu as a working area for a role.)');
        } else {
            console.log(`   Found ${tnAreas.length} "Tamil Nadu" area entry(ies). Seeding ${TN_DISTRICTS.length} districts each…`);
            for (const area of tnAreas) {
                await seedDistricts(db, area.id, area.eligible_area_name, TN_DISTRICTS);
            }
        }

        // ── STEP 2: Add "Karnataka (Bangalore)" area under roles that have TN ──
        console.log('\n📌 STEP 2: Adding "Karnataka (Bangalore)" working area…');
        const [tnAreaDetails] = await db.query(
            "SELECT id, role_id FROM part_time_eligible_areas WHERE eligible_area_name = 'Tamil Nadu'"
        );

        const kaAreaIds = [];
        let kaCreated = 0;
        let kaExisted = 0;

        for (const tn of tnAreaDetails) {
            // Check if Karnataka already exists for this role
            const [existing] = await db.query(
                "SELECT id FROM part_time_eligible_areas WHERE role_id = ? AND eligible_area_name = 'Karnataka (Bangalore)'",
                [tn.role_id]
            );

            if (existing.length > 0) {
                kaAreaIds.push({ id: existing[0].id, label: `role_id=${tn.role_id} (already existed)` });
                kaExisted++;
            } else {
                const [result] = await db.query(
                    "INSERT INTO part_time_eligible_areas (role_id, eligible_area_name, status) VALUES (?, 'Karnataka (Bangalore)', 1)",
                    [tn.role_id]
                );
                kaAreaIds.push({ id: result.insertId, label: `role_id=${tn.role_id} (newly added)` });
                kaCreated++;
            }
        }

        console.log(`   ✅ Karnataka (Bangalore): ${kaCreated} area entries created, ${kaExisted} already existed`);

        // ── STEP 3: Karnataka districts ───────────────────────────────────────
        console.log(`\n📌 STEP 3: Seeding Karnataka districts (${KA_DISTRICTS.length} districts)…`);
        for (const ka of kaAreaIds) {
            await seedDistricts(db, ka.id, `Karnataka (Bangalore) — ${ka.label}`, KA_DISTRICTS);
        }

        // ── Summary ───────────────────────────────────────────────────────────
        const [[{ tnCount }]] = await db.query(
            "SELECT COUNT(*) AS tnCount FROM part_time_area_districts d JOIN part_time_eligible_areas a ON d.area_id = a.id WHERE a.eligible_area_name = 'Tamil Nadu'"
        );
        const [[{ kaCount }]] = await db.query(
            "SELECT COUNT(*) AS kaCount FROM part_time_area_districts d JOIN part_time_eligible_areas a ON d.area_id = a.id WHERE a.eligible_area_name = 'Karnataka (Bangalore)'"
        );

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✅ Migration 008 Complete');
        console.log(`     Tamil Nadu district records in DB : ${tnCount}`);
        console.log(`     Karnataka district records in DB  : ${kaCount}`);
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (err) {
        console.error('\n❌ Migration 008 failed:', err.message);
        process.exit(1);
    } finally {
        await db.end();
    }
})();
