'use strict';
/**
 * Enterprise Roster Module
 * Subject-level, merit+community seat pattern generation with full
 * settings management, version control, import/export, and audit log.
 */

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { safeError } = require('../../../shared/security/safeError');
const ExcelJS = require('exceljs');
const multer  = require('multer');
const path    = require('path');

// ── UPLOAD ────────────────────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls', '.csv'].includes(ext)) return cb(null, true);
        cb(new Error('Only .xlsx, .xls, .csv files are accepted'));
    },
});

// ── DB MIGRATION ──────────────────────────────────────────────────────────────
(async () => {
    try {
        // Rename legacy tables to avoid schema conflicts
        for (const [old, neo] of [
            ['roster_merit_list',     'roster_merit_list_legacy'],
            ['roster_category_config','roster_category_config_legacy'],
            ['roster_merit_config',   'roster_merit_config_legacy'],
            ['roster_audit_log',      'roster_audit_log_legacy'],
            ['roster_entries',        'roster_entries_legacy'],
        ]) {
            await pool.query(`RENAME TABLE \`${old}\` TO \`${neo}\``).catch(e => {
                // Ignore if source doesn't exist or already renamed
                if (!e.message.includes("doesn't exist") && !e.message.includes('already exists')) {
                    console.error(`[Roster rename] ${old}:`, e.message);
                }
            });
        }

        // Global roster settings (merit/community split)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_settings (
                id                   INT AUTO_INCREMENT PRIMARY KEY,
                merit_percentage     DECIMAL(5,2) NOT NULL DEFAULT 50.00,
                community_percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00,
                updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // Seed default if empty
        await pool.query(`INSERT IGNORE INTO roster_settings (id, merit_percentage, community_percentage) VALUES (1, 50, 50)`);

        // Community seat distribution
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_community_distribution (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                community_code VARCHAR(30) NOT NULL UNIQUE,
                display_name   VARCHAR(50) NOT NULL,
                percentage     DECIMAL(5,2) NOT NULL DEFAULT 0,
                display_order  INT NOT NULL DEFAULT 0,
                is_active      TINYINT(1) NOT NULL DEFAULT 1,
                updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // Seed defaults
        const defaultComm = [
            ['OC','OC',31.0,1],['BC','BC',26.5,2],['BCM','BCM',3.5,3],
            ['MBC/DNC','MBC/DNC',20.0,4],['SC','SC',15.0,5],['SCA','SCA',3.0,6],['ST','ST',1.0,7],
        ];
        for (const [code, name, pct, ord] of defaultComm) {
            await pool.query(
                `INSERT IGNORE INTO roster_community_distribution (community_code,display_name,percentage,display_order) VALUES (?,?,?,?)`,
                [code, name, pct, ord]
            );
        }

        // Community conversion rules (configurable chain)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_conversion_rules (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                source_community VARCHAR(30) NOT NULL,
                target_community VARCHAR(30) NOT NULL,
                priority_order   INT NOT NULL DEFAULT 1,
                is_active        TINYINT(1) NOT NULL DEFAULT 1,
                updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_src_tgt (source_community, target_community)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        const defaultRules = [
            ['BCM','BC',1],['BC','OC',1],['MBC/DNC','BC',1],
            ['SC','MBC/DNC',1],['SCA','SC',1],['ST','SC',1],
        ];
        for (const [src, tgt, pri] of defaultRules) {
            await pool.query(
                `INSERT IGNORE INTO roster_conversion_rules (source_community,target_community,priority_order) VALUES (?,?,?)`,
                [src, tgt, pri]
            );
        }

        // Subject intake configuration (the vacancy engine)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_subject_intakes (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                subject_name VARCHAR(255) NOT NULL,
                intake_count INT NOT NULL DEFAULT 0,
                is_active    TINYINT(1) NOT NULL DEFAULT 1,
                updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_subject (subject_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Roster header (one per subject+session+version)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rosters (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                session_id     INT NOT NULL,
                session_label  VARCHAR(50) NULL,
                subject_name   VARCHAR(255) NOT NULL,
                vacancy_count  INT NOT NULL DEFAULT 0,
                merit_seats    INT NOT NULL DEFAULT 0,
                community_seats INT NOT NULL DEFAULT 0,
                version        INT NOT NULL DEFAULT 1,
                version_label  VARCHAR(50) NULL,
                status         ENUM('Draft','Approved','Locked','Archived') NOT NULL DEFAULT 'Draft',
                generated_by   INT NULL,
                generated_by_name VARCHAR(255) NULL,
                generated_at   DATETIME NULL,
                approved_by    INT NULL,
                approved_at    DATETIME NULL,
                locked_by      INT NULL,
                locked_at      DATETIME NULL,
                notes          TEXT NULL,
                settings_snapshot JSON NULL,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_session   (session_id),
                INDEX idx_subject   (subject_name),
                INDEX idx_status    (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        // Add updated_at to existing rosters table if missing (safe ALTER)
        await pool.query(`ALTER TABLE rosters ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).catch(e => {
            if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
                console.error('[Roster] rosters.updated_at alter:', e.message);
            }
        });

        // Roster entries — ordered seat positions with category
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_entries (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                roster_id      INT NOT NULL,
                position_no    INT NOT NULL,
                category       VARCHAR(30) NOT NULL,
                converted_from VARCHAR(30) NULL,
                remarks        TEXT NULL,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_roster_id  (roster_id),
                INDEX idx_position   (position_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Import logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_import_logs (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                subject_name VARCHAR(255) NULL,
                file_name   VARCHAR(255) NOT NULL,
                imported_by INT NULL,
                imported_by_name VARCHAR(255) NULL,
                imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status      ENUM('Success','Failed','Partial') NOT NULL DEFAULT 'Success',
                rows_total  INT NOT NULL DEFAULT 0,
                rows_ok     INT NOT NULL DEFAULT 0,
                rows_error  INT NOT NULL DEFAULT 0,
                error_details JSON NULL,
                roster_id   INT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Audit logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_audit_logs (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                roster_id   INT NULL,
                user_id     INT NULL,
                user_name   VARCHAR(255) NULL,
                action      VARCHAR(100) NOT NULL,
                entity      VARCHAR(100) NULL,
                old_value   JSON NULL,
                new_value   JSON NULL,
                ip_address  VARCHAR(45) NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_roster_id  (roster_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('✅ Roster Management tables verified/created.');
    } catch (err) {
        console.error('❌ Roster DB setup error:', err.message);
    }
})();

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function audit(db, { rosterId, userId, userName, action, entity, oldValue, newValue, ip }) {
    await db.execute(
        `INSERT INTO roster_audit_logs (roster_id,user_id,user_name,action,entity,old_value,new_value,ip_address) VALUES (?,?,?,?,?,?,?,?)`,
        [rosterId || null, userId || null, userName || null, action,
         entity || null,
         oldValue  ? JSON.stringify(oldValue)  : null,
         newValue  ? JSON.stringify(newValue)  : null,
         ip || null]
    ).catch(e => console.error('[RosterAudit]', e.message));
}

function buildRosterSequence(vacancyCount, meritPct, distribution) {
    const active = distribution.filter(d => d.is_active).sort((a, b) => a.display_order - b.display_order);

    // Each percentage is % of total vacancy: merit% + all community% = 100%
    const meritSeats = Math.round(vacancyCount * parseFloat(meritPct) / 100);
    const seats = {};
    let totalCommAssigned = 0;
    for (const d of active) {
        const cnt = Math.floor(vacancyCount * parseFloat(d.percentage) / 100);
        seats[d.community_code] = cnt;
        totalCommAssigned += cnt;
    }
    // Distribute rounding remainder to highest-% communities first
    let remainder = vacancyCount - meritSeats - totalCommAssigned;
    for (const d of [...active].sort((a, b) => b.percentage - a.percentage)) {
        if (remainder <= 0) break;
        seats[d.community_code] = (seats[d.community_code] || 0) + 1;
        remainder--;
    }

    // Build community sequence: round-robin by display_order
    const commList = [];
    const maxRounds = active.length ? Math.max(0, ...active.map(d => seats[d.community_code] || 0)) : 0;
    for (let round = 0; round < maxRounds; round++) {
        for (const d of active) {
            if ((seats[d.community_code] || 0) > round) commList.push(d.community_code);
        }
    }

    // Interleave merit and community (merit first in each pair)
    const entries = [];
    let m = 0, c = 0;
    while (m < meritSeats || c < commList.length) {
        if (m < meritSeats)      { entries.push({ category: 'Merit',     converted_from: null }); m++; }
        if (c < commList.length) { entries.push({ category: commList[c], converted_from: null }); c++; }
    }
    return entries.map((e, i) => ({ ...e, position_no: i + 1 }));
}

async function getActiveSession(db) {
    const [[row]] = await db.execute(`SELECT id, CONCAT(month,' ',year) AS label FROM sessions WHERE is_active = 1 LIMIT 1`);
    return row || null;
}

async function getSettings(db) {
    const [[s]] = await db.execute(`SELECT merit_percentage, community_percentage FROM roster_settings WHERE id = 1`);
    return s || { merit_percentage: 50, community_percentage: 50 };
}

async function getDistribution(db) {
    const [rows] = await db.execute(`SELECT * FROM roster_community_distribution WHERE is_active = 1 ORDER BY display_order`);
    return rows;
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/roster/settings
router.get('/settings', verifyToken, isAdmin, async (_req, res) => {
    try {
        const s = await getSettings(pool);
        res.json({ success: true, data: s });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PUT /api/roster/settings
router.put('/settings', verifyToken, isAdmin, async (req, res) => {
    const { merit_percentage } = req.body;
    const mp = parseFloat(merit_percentage);
    if (isNaN(mp) || mp < 0 || mp > 100)
        return res.status(400).json({ success: false, message: 'merit_percentage must be 0–100' });
    try {
        // Store merit; community_percentage column preserved for legacy but not used in generation
        await pool.execute(`UPDATE roster_settings SET merit_percentage=? WHERE id=1`, [mp]);
        await audit(pool, { userId: req.user?.id, userName: req.user?.email, action: 'SETTINGS_UPDATED',
            entity: 'roster_settings', newValue: { merit_percentage: mp }, ip: req.ip });
        res.json({ success: true, message: 'Merit percentage saved', data: { merit_percentage: mp } });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// GET /api/roster/community-distribution
router.get('/community-distribution', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM roster_community_distribution ORDER BY display_order`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PUT /api/roster/community-distribution
// Community percentages are % of TOTAL vacancy; merit% + sum(community%) must = 100 exactly.
router.put('/community-distribution', verifyToken, isAdmin, async (req, res) => {
    const { distribution, merit_percentage } = req.body;
    if (!Array.isArray(distribution) || !distribution.length)
        return res.status(400).json({ success: false, message: 'distribution array required' });

    // Allow frontend to pass merit_percentage together, or read from DB
    let meritPct = parseFloat(merit_percentage);
    if (isNaN(meritPct)) {
        const [[s]] = await pool.execute(`SELECT merit_percentage FROM roster_settings WHERE id=1`);
        meritPct = parseFloat(s?.merit_percentage || 0);
    }

    const active = distribution.filter(d => d.is_active !== false && d.is_active !== 0);
    const commTotal  = active.reduce((s, d) => s + parseFloat(d.percentage || 0), 0);
    const overallTotal = meritPct + commTotal;
    if (Math.abs(overallTotal - 100) > 0.01) {
        return res.status(400).json({
            success: false,
            message: `Merit (${meritPct}%) + Community Total (${commTotal.toFixed(2)}%) = ${overallTotal.toFixed(2)}%. Must equal exactly 100%.`,
        });
    }
    try {
        // If merit_percentage was provided alongside, save it too
        if (!isNaN(parseFloat(merit_percentage))) {
            await pool.execute(`UPDATE roster_settings SET merit_percentage=? WHERE id=1`, [meritPct]);
        }
        for (const d of distribution) {
            await pool.execute(
                `INSERT INTO roster_community_distribution (community_code,display_name,percentage,display_order,is_active) VALUES (?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), percentage=VALUES(percentage),
                 display_order=VALUES(display_order), is_active=VALUES(is_active), updated_at=NOW()`,
                [d.community_code, d.display_name || d.community_code, parseFloat(d.percentage), parseInt(d.display_order) || 0, d.is_active ? 1 : 0]
            );
        }
        await audit(pool, { userId: req.user?.id, userName: req.user?.email, action: 'COMMUNITY_DIST_UPDATED',
            entity: 'roster_community_distribution', newValue: { merit_percentage: meritPct, distribution }, ip: req.ip });
        res.json({ success: true, message: 'Settings saved — overall total: 100%' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// GET /api/roster/conversion-rules
router.get('/conversion-rules', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM roster_conversion_rules ORDER BY source_community, priority_order`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// POST /api/roster/conversion-rules
router.post('/conversion-rules', verifyToken, isAdmin, async (req, res) => {
    const { source_community, target_community, priority_order } = req.body;
    if (!source_community || !target_community)
        return res.status(400).json({ success: false, message: 'source_community and target_community required' });
    try {
        const [r] = await pool.execute(
            `INSERT INTO roster_conversion_rules (source_community,target_community,priority_order) VALUES (?,?,?)`,
            [source_community, target_community, parseInt(priority_order) || 1]
        );
        await audit(pool, { userId: req.user?.id, userName: req.user?.email, action: 'CONVERSION_RULE_ADDED',
            entity: 'roster_conversion_rules', newValue: { source_community, target_community, priority_order }, ip: req.ip });
        res.json({ success: true, message: 'Conversion rule added', id: r.insertId });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PUT /api/roster/conversion-rules/:id
router.put('/conversion-rules/:id', verifyToken, isAdmin, async (req, res) => {
    const { source_community, target_community, priority_order, is_active } = req.body;
    try {
        await pool.execute(
            `UPDATE roster_conversion_rules SET source_community=?,target_community=?,priority_order=?,is_active=?,updated_at=NOW() WHERE id=?`,
            [source_community, target_community, parseInt(priority_order) || 1, is_active ? 1 : 0, req.params.id]
        );
        res.json({ success: true, message: 'Conversion rule updated' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// DELETE /api/roster/conversion-rules/:id
router.delete('/conversion-rules/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute(`DELETE FROM roster_conversion_rules WHERE id=?`, [req.params.id]);
        res.json({ success: true, message: 'Conversion rule deleted' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// GET /api/roster/subject-intakes
router.get('/subject-intakes', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM roster_subject_intakes ORDER BY subject_name`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// POST /api/roster/subject-intakes
router.post('/subject-intakes', verifyToken, isAdmin, async (req, res) => {
    const { subject_name, intake_count } = req.body;
    if (!subject_name) return res.status(400).json({ success: false, message: 'subject_name required' });
    try {
        const [r] = await pool.execute(
            `INSERT INTO roster_subject_intakes (subject_name, intake_count) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE intake_count=VALUES(intake_count), updated_at=NOW()`,
            [subject_name.trim(), parseInt(intake_count) || 0]
        );
        res.json({ success: true, message: 'Subject intake saved', id: r.insertId });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PUT /api/roster/subject-intakes/:id
router.put('/subject-intakes/:id', verifyToken, isAdmin, async (req, res) => {
    const { intake_count, is_active } = req.body;
    try {
        await pool.execute(
            `UPDATE roster_subject_intakes SET intake_count=?, is_active=?, updated_at=NOW() WHERE id=?`,
            [parseInt(intake_count) || 0, is_active ? 1 : 0, req.params.id]
        );
        res.json({ success: true, message: 'Subject intake updated' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// DELETE /api/roster/subject-intakes/:id
router.delete('/subject-intakes/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        await pool.execute(`DELETE FROM roster_subject_intakes WHERE id=?`, [req.params.id]);
        res.json({ success: true, message: 'Subject intake deleted' });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// GENERATION
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/roster/subjects  — subjects with vacancy info
router.get('/subjects', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT ds.id, ds.name AS subject_name,
                   COALESCE(ri.intake_count, 0) AS intake_count,
                   COALESCE(ri.is_active, 0)    AS has_intake
            FROM dropdown_subjects ds
            LEFT JOIN roster_subject_intakes ri ON ri.subject_name = ds.name AND ri.is_active = 1
            ORDER BY ds.name
        `);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// GET /api/roster/vacancy/:subject_name
router.get('/vacancy/:subject_name', verifyToken, isAdmin, async (req, res) => {
    try {
        const subj = decodeURIComponent(req.params.subject_name);
        const [[ri]] = await pool.execute(
            `SELECT intake_count FROM roster_subject_intakes WHERE subject_name = ? AND is_active = 1`,
            [subj]
        );
        const session = await getActiveSession(pool);
        res.json({ success: true, data: {
            subject_name:  subj,
            vacancy_count: ri ? ri.intake_count : 0,
            has_intake:    !!ri,
            session,
        }});
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// GET /api/roster/active-session
router.get('/active-session', verifyToken, isAdmin, async (_req, res) => {
    try {
        const session = await getActiveSession(pool);
        res.json({ success: true, data: session });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// POST /api/roster/generate
router.post('/generate', verifyToken, isAdmin, async (req, res) => {
    const { subject_name, notes } = req.body;
    if (!subject_name) return res.status(400).json({ success: false, message: 'subject_name required' });

    const userName = req.user?.email || req.user?.name || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Active session
        const session = await getActiveSession(conn);
        if (!session) { await conn.rollback(); return res.status(400).json({ success: false, message: 'No active session found. Activate a session first.' }); }

        // Vacancy
        const [[intake]] = await conn.execute(
            `SELECT intake_count FROM roster_subject_intakes WHERE subject_name = ? AND is_active = 1`,
            [subject_name]
        );
        if (!intake || intake.intake_count <= 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `No intake configured for subject "${subject_name}". Set it in Roster → Settings → Subject Intakes.` });
        }
        const vacancyCount = intake.intake_count;

        // Settings
        const settings     = await getSettings(conn);
        const distribution = await getDistribution(conn);
        if (!distribution.length) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Community distribution not configured.' }); }

        // ── STRICT 100% VALIDATION (UI + API + DB Transaction level) ──────────
        const commTotal    = distribution.reduce((s, d) => s + parseFloat(d.percentage || 0), 0);
        const overallTotal = parseFloat(settings.merit_percentage) + commTotal;
        if (Math.abs(overallTotal - 100) > 0.01) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot generate roster: Merit (${settings.merit_percentage}%) + Community Total (${commTotal.toFixed(2)}%) = ${overallTotal.toFixed(2)}%. Must equal exactly 100%. Fix in Roster → Settings.`,
            });
        }

        // Next version for this subject+session
        const [[{ maxVer }]] = await conn.execute(
            `SELECT COALESCE(MAX(version),0) AS maxVer FROM rosters WHERE session_id=? AND subject_name=?`,
            [session.id, subject_name]
        );
        const version      = maxVer + 1;
        const versionLabel = `${subject_name.replace(/\s+/g, '-').toUpperCase().substring(0, 10)}-${new Date().getFullYear()}-V${version}`;
        // Seat counts using absolute % of total vacancy
        const meritSeats   = Math.round(vacancyCount * parseFloat(settings.merit_percentage) / 100);
        const commSeats    = vacancyCount - meritSeats;

        // Generate sequence
        const entries = buildRosterSequence(vacancyCount, settings.merit_percentage, distribution);

        // Insert roster header
        const [hdr] = await conn.execute(
            `INSERT INTO rosters (session_id,session_label,subject_name,vacancy_count,merit_seats,community_seats,
             version,version_label,status,generated_by,generated_by_name,generated_at,notes,settings_snapshot)
             VALUES (?,?,?,?,?,?,?,?,'Draft',?,?,NOW(),?,?)`,
            [session.id, session.label, subject_name, vacancyCount, meritSeats, commSeats,
             version, versionLabel,
             req.user?.id || null, userName, notes || null,
             JSON.stringify({ merit_percentage: settings.merit_percentage, community_percentage: settings.community_percentage, distribution })]
        );
        const rosterId = hdr.insertId;

        // Insert entries
        for (const e of entries) {
            await conn.execute(
                `INSERT INTO roster_entries (roster_id,position_no,category,converted_from) VALUES (?,?,?,?)`,
                [rosterId, e.position_no, e.category, e.converted_from || null]
            );
        }

        await audit(conn, {
            rosterId, userId: req.user?.id, userName,
            action: 'ROSTER_GENERATED',
            entity: 'rosters',
            newValue: { subject_name, session_id: session.id, version, vacancy_count: vacancyCount, merit_seats: meritSeats, community_seats: commSeats },
            ip: req.ip,
        });

        await conn.commit();
        res.json({ success: true, message: `Roster generated — ${entries.length} positions (${versionLabel})`, data: { roster_id: rosterId, version, version_label: versionLabel, entries } });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROSTERS LIST & DETAIL
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/roster/rosters
router.get('/rosters', verifyToken, isAdmin, async (req, res) => {
    try {
        const { subject_name, status, session_id } = req.query;
        const conds = [], params = [];
        if (subject_name) { conds.push('r.subject_name LIKE ?'); params.push(`%${subject_name}%`); }
        if (status)       { conds.push('r.status = ?');         params.push(status); }
        if (session_id)   { conds.push('r.session_id = ?');     params.push(session_id); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const [rows] = await pool.query(`SELECT * FROM rosters ${where} ORDER BY subject_name, version DESC`, params);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// GET /api/roster/rosters/:id
router.get('/rosters/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[roster]] = await pool.execute(`SELECT * FROM rosters WHERE id=?`, [req.params.id]);
        if (!roster) return res.status(404).json({ success: false, message: 'Roster not found' });
        const [entries] = await pool.execute(`SELECT * FROM roster_entries WHERE roster_id=? ORDER BY position_no`, [req.params.id]);
        res.json({ success: true, data: { roster, entries } });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// PATCH /api/roster/rosters/:id/status
router.patch('/rosters/:id/status', verifyToken, isAdmin, async (req, res) => {
    const { status, notes } = req.body;
    const valid = ['Draft','Approved','Locked','Archived'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, message: `status must be one of: ${valid.join(', ')}` });
    const userName = req.user?.email || req.user?.name || 'Admin';
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[r]] = await conn.execute(`SELECT status, subject_name FROM rosters WHERE id=?`, [req.params.id]);
        if (!r) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }
        if (r.status === 'Locked' && status !== 'Archived')
            { await conn.rollback(); return res.status(403).json({ success: false, message: 'Locked rosters can only be Archived' }); }

        const sets = ['status=?', 'updated_at=NOW()'];
        const vals = [status];
        if (notes) { sets.push('notes=?'); vals.push(notes); }
        if (status === 'Approved') { sets.push('approved_by=?', 'approved_at=NOW()'); vals.push(req.user?.id || null); }
        if (status === 'Locked')   { sets.push('locked_by=?',   'locked_at=NOW()');   vals.push(req.user?.id || null); }
        vals.push(req.params.id);

        await conn.execute(`UPDATE rosters SET ${sets.join(', ')} WHERE id=?`, vals);
        await audit(conn, { rosterId: parseInt(req.params.id), userId: req.user?.id, userName,
            action: `STATUS_${status.toUpperCase()}`, entity: 'rosters',
            oldValue: { status: r.status }, newValue: { status }, ip: req.ip });
        await conn.commit();
        res.json({ success: true, message: `Roster ${status}` });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// DELETE /api/roster/rosters/:id  (Draft only)
router.delete('/rosters/:id', verifyToken, isAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[r]] = await conn.execute(`SELECT status, subject_name FROM rosters WHERE id=?`, [req.params.id]);
        if (!r) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }
        if (r.status !== 'Draft') { await conn.rollback(); return res.status(403).json({ success: false, message: 'Only Draft rosters can be deleted' }); }
        await conn.execute(`DELETE FROM roster_entries WHERE roster_id=?`, [req.params.id]);
        await conn.execute(`DELETE FROM rosters WHERE id=?`, [req.params.id]);
        await audit(conn, {
            rosterId: parseInt(req.params.id), userId: req.user?.id,
            userName: req.user?.email || req.user?.name || 'Admin',
            action: 'ROSTER_DELETED', entity: 'rosters',
            oldValue: { id: parseInt(req.params.id), subject_name: r.subject_name, status: r.status },
            ip: req.ip,
        });
        await conn.commit();
        res.json({ success: true, message: 'Roster deleted' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: safeError(err) });
    } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════════════════════════
// IMPORT
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/roster/import
router.post('/import', verifyToken, isAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { subject_name } = req.body;
    if (!subject_name) return res.status(400).json({ success: false, message: 'subject_name required' });

    const userName = req.user?.email || req.user?.name || 'Admin';
    const validCats = new Set(['Merit','OC','BC','BCM','MBC/DNC','SC','SCA','ST']);
    const errors = [];
    let rows = [];

    try {
        const wb   = new ExcelJS.Workbook();
        const ext  = path.extname(req.file.originalname).toLowerCase();
        if (ext === '.csv') {
            const text  = req.file.buffer.toString('utf8');
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (!lines.length) return res.status(400).json({ success: false, message: 'File is empty' });
            const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
            const posIdx  = header.findIndex(h => h.includes('position'));
            const catIdx  = header.findIndex(h => h.includes('category'));
            const remIdx  = header.findIndex(h => h.includes('remark'));
            if (posIdx < 0 || catIdx < 0) {
                return res.status(400).json({ success: false, message: 'CSV must have "Position No" and "Category" columns in the header row' });
            }
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
                rows.push({ position_no: cols[posIdx], category: cols[catIdx], remarks: remIdx >= 0 ? cols[remIdx] : null, row: i + 1 });
            }
        } else {
            await wb.xlsx.load(req.file.buffer);
            const ws = wb.worksheets[0];
            if (!ws) return res.status(400).json({ success: false, message: 'Excel file has no worksheets' });
            const header = [];
            ws.getRow(1).eachCell((cell, col) => { header[col] = (cell.value || '').toString().toLowerCase().trim(); });
            // ExcelJS is 1-indexed; findIndex on 1-indexed array returns 1-based index (or -1).
            // Subtract 1 to get 0-based index for vals array.
            const posRaw  = header.findIndex(h => h && h.includes('position'));
            const catRaw  = header.findIndex(h => h && h.includes('category'));
            const remRaw  = header.findIndex(h => h && h.includes('remark'));
            if (posRaw < 0 || catRaw < 0) {
                return res.status(400).json({ success: false, message: 'Excel must have "Position No" and "Category" columns in the first row' });
            }
            const posIdx = posRaw - 1;
            const catIdx = catRaw - 1;
            const remIdx = remRaw >= 0 ? remRaw - 1 : -1;
            ws.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const vals = [];
                row.eachCell({ includeEmpty: true }, (cell, col) => { vals[col - 1] = cell.value; });
                rows.push({ position_no: vals[posIdx], category: vals[catIdx], remarks: remIdx >= 0 ? vals[remIdx] : null, row: rowNum });
            });
        }

        // Validate
        const positions = new Set();
        for (const r of rows) {
            const pos = parseInt(r.position_no);
            const cat = (r.category || '').toString().trim();
            if (isNaN(pos) || pos < 1)  errors.push(`Row ${r.row}: Invalid position "${r.position_no}"`);
            else if (positions.has(pos)) errors.push(`Row ${r.row}: Duplicate position ${pos}`);
            else positions.add(pos);
            if (!validCats.has(cat)) errors.push(`Row ${r.row}: Invalid category "${cat}" (allowed: ${[...validCats].join(', ')})`);
        }
        // Check consecutive positions
        const sorted = [...positions].sort((a, b) => a - b);
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i] !== i + 1) { errors.push(`Missing position ${i + 1}`); break; }
        }

        if (errors.length) {
            await pool.execute(
                `INSERT INTO roster_import_logs (subject_name,file_name,imported_by,imported_by_name,status,rows_total,rows_ok,rows_error,error_details)
                 VALUES (?,?,?,?,'Failed',?,0,?,?)`,
                [subject_name, req.file.originalname, req.user?.id, userName,
                 rows.length, errors.length, JSON.stringify(errors)]
            );
            return res.status(422).json({ success: false, message: 'Import validation failed', errors });
        }

        // Save
        const session = await getActiveSession(pool);
        if (!session) return res.status(400).json({ success: false, message: 'No active session' });

        const [[{ maxVer }]] = await pool.execute(
            `SELECT COALESCE(MAX(version),0) AS maxVer FROM rosters WHERE session_id=? AND subject_name=?`,
            [session.id, subject_name]
        );
        const version = maxVer + 1;
        const vLabel  = `${subject_name.toUpperCase().substring(0, 10)}-${new Date().getFullYear()}-V${version}-IMPORT`;

        const conn = await pool.getConnection();
        let rosterId;
        try {
            await conn.beginTransaction();
            const [hdr] = await conn.execute(
                `INSERT INTO rosters (session_id,session_label,subject_name,vacancy_count,merit_seats,community_seats,
                 version,version_label,status,generated_by,generated_by_name,generated_at,notes)
                 VALUES (?,?,?,?,?,?,?,?,'Draft',?,?,NOW(),'Imported from Excel/CSV')`,
                [session.id, session.label, subject_name, rows.length,
                 rows.filter(r => r.category === 'Merit').length,
                 rows.filter(r => r.category !== 'Merit').length,
                 version, vLabel, req.user?.id || null, userName]
            );
            rosterId = hdr.insertId;
            for (const r of rows) {
                await conn.execute(
                    `INSERT INTO roster_entries (roster_id,position_no,category,remarks) VALUES (?,?,?,?)`,
                    [rosterId, parseInt(r.position_no), r.category.trim(), r.remarks || null]
                );
            }
            await conn.commit();
        } catch (connErr) {
            await conn.rollback();
            throw connErr;
        } finally {
            conn.release();
        }

        await pool.execute(
            `INSERT INTO roster_import_logs (subject_name,file_name,imported_by,imported_by_name,status,rows_total,rows_ok,rows_error,roster_id)
             VALUES (?,?,?,?,'Success',?,?,0,?)`,
            [subject_name, req.file.originalname, req.user?.id, userName, rows.length, rows.length, rosterId]
        );
        await audit(pool, { rosterId, userId: req.user?.id, userName, action: 'ROSTER_IMPORTED',
            entity: 'rosters', newValue: { subject_name, version, rows_count: rows.length }, ip: req.ip });

        res.json({ success: true, message: `Imported ${rows.length} positions as ${vLabel}`, data: { roster_id: rosterId, version, version_label: vLabel } });
    } catch (err) {
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// GET /api/roster/import-logs
router.get('/import-logs', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT * FROM roster_import_logs ORDER BY imported_at DESC LIMIT 100`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/roster/rosters/:id/export?format=excel|csv
router.get('/rosters/:id/export', verifyToken, isAdmin, async (req, res) => {
    try {
        const [[roster]] = await pool.execute(`SELECT * FROM rosters WHERE id=?`, [req.params.id]);
        if (!roster) return res.status(404).json({ success: false, message: 'Not found' });
        const [entries] = await pool.execute(`SELECT * FROM roster_entries WHERE roster_id=? ORDER BY position_no`, [req.params.id]);

        const fmt = (req.query.format || 'excel').toLowerCase();

        if (fmt === 'csv') {
            const lines = ['Position No,Category,Converted From,Remarks'];
            entries.forEach(e => lines.push(`${e.position_no},${e.category},${e.converted_from || ''},${e.remarks || ''}`));
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="roster_${roster.version_label}_${Date.now()}.csv"`);
            return res.send(lines.join('\n'));
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = 'PhD ERP Roster Module';

        // Sheet 1: Summary
        const ws1 = wb.addWorksheet('Summary');
        ws1.columns = [{ header: 'Field', key: 'f', width: 25 }, { header: 'Value', key: 'v', width: 40 }];
        ws1.getRow(1).font = { bold: true };
        [['Roster', roster.version_label || '—'],['Subject', roster.subject_name],
         ['Session', roster.session_label || '—'],['Vacancy', roster.vacancy_count],
         ['Merit Seats', roster.merit_seats],['Community Seats', roster.community_seats],
         ['Status', roster.status],['Version', roster.version],
         ['Generated', roster.generated_at ? new Date(roster.generated_at).toLocaleString('en-IN') : '—'],
         ['Generated By', roster.generated_by_name || '—'],
        ].forEach(([f, v]) => ws1.addRow({ f, v }));

        // Sheet 2: Roster Sequence
        const ws2 = wb.addWorksheet('Roster Sequence');
        ws2.columns = [
            { header: 'Position No', key: 'position_no', width: 14 },
            { header: 'Category',    key: 'category',    width: 16 },
            { header: 'Converted From', key: 'converted_from', width: 18 },
            { header: 'Remarks',     key: 'remarks',     width: 30 },
        ];
        ws2.getRow(1).font = { bold: true };
        ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        entries.forEach(e => {
            const row = ws2.addRow(e);
            if (e.category === 'Merit') row.getCell(2).font = { color: { argb: 'FF1D4ED8' }, bold: true };
        });

        // Sheet 3: Category summary
        const ws3 = wb.addWorksheet('Category Summary');
        ws3.columns = [{ header: 'Category', key: 'cat', width: 20 }, { header: 'Seats', key: 'seats', width: 10 }];
        ws3.getRow(1).font = { bold: true };
        const counts = {};
        entries.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
        Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([cat, seats]) => ws3.addRow({ cat, seats }));

        await audit(pool, { rosterId: parseInt(req.params.id), userId: req.user?.id, userName: req.user?.email,
            action: 'ROSTER_EXPORTED', entity: 'rosters',
            newValue: { format: fmt, roster_id: req.params.id }, ip: req.ip });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="roster_${roster.version_label}_${Date.now()}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/roster/audit-logs
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    try {
        const { roster_id, action } = req.query;
        const safeLimit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 200));
        const conds = [], params = [];
        if (roster_id) { conds.push('roster_id=?'); params.push(roster_id); }
        if (action)    { conds.push('action LIKE ?'); params.push(`%${action}%`); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const [rows] = await pool.query(
            `SELECT * FROM roster_audit_logs ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`,
            params
        );
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: safeError(err) }); }
});

module.exports = router;
