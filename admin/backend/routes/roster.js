'use strict';

/**
 * PhD Admission Roster Management — Complete Rebuild
 *
 * Merit Score = Entrance Mark (/70) + Qualification Score (/30)
 * Qualification Score = (percentage / 100) × 30
 * Total Maximum = 100
 *
 * Reservation: OC 31%, BC 26.5%, BCM 3.5%, MBC/DNC 20%, SC 15%, SCA 3%, ST 1%
 * Conversion:  BC→OC | BCM→BC | MBC/DNC→BC | SC→MBC/DNC | ST→SC
 */

const express  = require('express');
const router   = express.Router();
const pool     = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const ExcelJS  = require('exceljs');
const multer   = require('multer');
const path     = require('path');

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORY_PERCENTAGES = {
    'OC':       31.0,
    'BC':       26.5,
    'BCM':       3.5,
    'MBC/DNC':  20.0,
    'SC':       15.0,
    'SCA':       3.0,
    'ST':        1.0,
};

const CONVERSION_CHAIN = {
    'BC':      'OC',
    'BCM':     'BC',
    'MBC/DNC': 'BC',
    'SC':      'MBC/DNC',
    'ST':      'SC',
};

const CATEGORY_ORDER = ['OC', 'BC', 'BCM', 'MBC/DNC', 'SC', 'SCA', 'ST'];

// ── DB SCHEMA (auto-create on startup) ─────────────────────────────────────────
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_merit_list (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                session_id               INT,
                application_id           VARCHAR(50) NOT NULL,
                applicant_name           VARCHAR(255),
                community                VARCHAR(50),
                entrance_mark            DECIMAL(5,2) NOT NULL DEFAULT 0,
                qualification_source     ENUM('PG','INTEGRATED') NOT NULL DEFAULT 'PG',
                qualification_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
                qualification_score      DECIMAL(5,2) NOT NULL DEFAULT 0,
                final_merit_score        DECIMAL(5,2) NOT NULL DEFAULT 0,
                merit_rank               INT,
                application_date         DATETIME,
                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_session_app (session_id, application_id),
                INDEX idx_session_id (session_id),
                INDEX idx_merit_rank  (merit_rank)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_entries (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                session_id               INT,
                roster_number            INT,
                application_id           VARCHAR(50) NOT NULL,
                applicant_name           VARCHAR(255),
                original_category        VARCHAR(50),
                allocated_category       VARCHAR(50),
                entrance_mark            DECIMAL(5,2),
                qualification_percentage DECIMAL(5,2),
                qualification_score      DECIMAL(5,2),
                final_merit_score        DECIMAL(5,2),
                merit_rank               INT,
                allocation_status        ENUM('ALLOCATED','WAITING','NOT_ALLOCATED') DEFAULT 'NOT_ALLOCATED',
                is_converted             TINYINT(1) DEFAULT 0,
                conversion_from          VARCHAR(50),
                conversion_to            VARCHAR(50),
                created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_by               INT,
                UNIQUE KEY uq_session_app (session_id, application_id),
                INDEX idx_session_id (session_id),
                INDEX idx_merit_rank  (merit_rank),
                INDEX idx_category    (original_category),
                INDEX idx_status      (allocation_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_category_config (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                session_id    INT DEFAULT NULL,
                category_name VARCHAR(50) NOT NULL,
                percentage    DECIMAL(5,2) NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_session_cat (session_id, category_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS roster_audit_log (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                session_id  INT,
                user_id     INT,
                user_email  VARCHAR(255),
                action      VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100),
                entity_id   VARCHAR(100),
                old_value   JSON,
                new_value   JSON,
                ip_address  VARCHAR(45),
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_id (session_id),
                INDEX idx_action     (action),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('✅ Roster Management tables verified/created.');
    } catch (err) {
        console.error('❌ Roster Management DB setup error:', err.message);
    }
})();

// ── HELPERS ────────────────────────────────────────────────────────────────────

function calcQualScore(pct) {
    return Math.round((parseFloat(pct) / 100) * 30 * 100) / 100;
}

function calcMeritScore(entranceMark, qualScore) {
    return Math.round((parseFloat(entranceMark) + parseFloat(qualScore)) * 100) / 100;
}

function normalizeCategory(community) {
    if (!community) return 'OC';
    const c = community.trim().toUpperCase();
    if (['BCM','BC(M)','BC(MUSLIM)','BC(MUSLIMS)','BC-MUSLIM'].includes(c)) return 'BCM';
    if (['MBC/DNC','MBC','DNC','MBC & DNC','MBC AND DNC'].includes(c))      return 'MBC/DNC';
    if (['SCA','SC(A)','SC(ARUNTHATHIYAR)'].includes(c))                    return 'SCA';
    if (['OC','GENERAL','GEN','UR','OPEN'].includes(c))                     return 'OC';
    if (c === 'BC') return 'BC';
    if (c === 'SC') return 'SC';
    if (c === 'ST') return 'ST';
    return c;
}

function getCategoryVacancies(categoryConfig, totalSeats) {
    const vacancies = {};
    let assigned = 0;
    for (const cat of CATEGORY_ORDER) {
        if (categoryConfig[cat] === undefined) continue;
        const seats = Math.round(totalSeats * (categoryConfig[cat] / 100));
        vacancies[cat] = seats;
        assigned += seats;
    }
    const diff = totalSeats - assigned;
    if (diff !== 0 && vacancies['OC'] !== undefined) {
        vacancies['OC'] = Math.max(0, vacancies['OC'] + diff);
    }
    return vacancies;
}

function getAllocatedCategory(originalCategory, vacancies) {
    const cat = normalizeCategory(originalCategory);
    if ((vacancies[cat] || 0) > 0) {
        return { allocatedCat: cat, converted: false, from: null, to: null };
    }
    let current = cat;
    const visited = new Set([current]);
    while (CONVERSION_CHAIN[current]) {
        current = CONVERSION_CHAIN[current];
        if (visited.has(current)) break;
        visited.add(current);
        if ((vacancies[current] || 0) > 0) {
            return { allocatedCat: current, converted: true, from: cat, to: current };
        }
    }
    return { allocatedCat: null, converted: false, from: null, to: null };
}

async function writeAuditLog(db, { sessionId, userId, userEmail, action, entityType, entityId, oldValue, newValue, ip }) {
    try {
        await db.execute(
            `INSERT INTO roster_audit_log
             (session_id, user_id, user_email, action, entity_type, entity_id, old_value, new_value, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sessionId  || null,
                userId     || null,
                userEmail  || null,
                action,
                entityType || null,
                entityId   ? String(entityId) : null,
                oldValue   ? JSON.stringify(oldValue) : null,
                newValue   ? JSON.stringify(newValue) : null,
                ip         || null,
            ]
        );
    } catch (e) {
        console.error('[RosterAudit] write error:', e.message);
    }
}

const importUpload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls'].includes(ext)) return cb(null, true);
        cb(new Error('Only .xlsx and .xls files are accepted'));
    },
});

// ══════════════════════════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/roster/sessions
router.get('/sessions', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id,
                    CONCAT(year, ' — ', month) AS session_name,
                    year, month, is_active
             FROM sessions ORDER BY id DESC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/roster/dashboard/:session_id
router.get('/dashboard/:session_id', verifyToken, isAdmin, async (req, res) => {
    const sid = req.params.session_id;
    try {
        const [[meritRow]] = await pool.query(
            'SELECT COUNT(*) AS total FROM roster_merit_list WHERE session_id = ?', [sid]
        );
        const [[allocRow]] = await pool.query(`
            SELECT COUNT(*) AS total,
                   SUM(allocation_status='ALLOCATED')     AS allocated,
                   SUM(allocation_status='WAITING')       AS waiting,
                   SUM(allocation_status='NOT_ALLOCATED') AS not_allocated
            FROM roster_entries WHERE session_id = ?
        `, [sid]);
        const [catRows] = await pool.query(`
            SELECT allocated_category AS category, COUNT(*) AS count
            FROM roster_entries
            WHERE session_id = ? AND allocation_status = 'ALLOCATED'
            GROUP BY allocated_category ORDER BY count DESC
        `, [sid]);
        const [[convRow]] = await pool.query(
            'SELECT COUNT(*) AS total FROM roster_entries WHERE session_id = ? AND is_converted = 1', [sid]
        );
        const [[scoreRow]] = await pool.query(
            'SELECT MAX(final_merit_score) AS highest, MIN(final_merit_score) AS lowest, ROUND(AVG(final_merit_score),2) AS avg FROM roster_merit_list WHERE session_id = ?', [sid]
        );
        res.json({
            success: true,
            data: {
                meritTotal:        meritRow.total || 0,
                allocated:         Number(allocRow.allocated)    || 0,
                waiting:           Number(allocRow.waiting)      || 0,
                notAllocated:      Number(allocRow.not_allocated) || 0,
                totalRoster:       Number(allocRow.total)        || 0,
                categoryBreakdown: catRows,
                totalConverted:    Number(convRow.total)         || 0,
                scoreStats:        scoreRow,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/roster/category-config
router.get('/category-config', verifyToken, isAdmin, async (req, res) => {
    const { session_id } = req.query;
    try {
        let rows = [];
        if (session_id) {
            [rows] = await pool.query(
                'SELECT * FROM roster_category_config WHERE session_id = ?', [session_id]
            );
        }
        if (!rows.length) {
            return res.json({
                success: true,
                data: CATEGORY_ORDER.map(cat => ({
                    category_name: cat,
                    percentage:    DEFAULT_CATEGORY_PERCENTAGES[cat],
                    session_id:    session_id || null,
                })),
            });
        }
        rows.sort((a, b) => CATEGORY_ORDER.indexOf(a.category_name) - CATEGORY_ORDER.indexOf(b.category_name));
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/roster/category-config
router.put('/category-config', verifyToken, isAdmin, async (req, res) => {
    const { session_id, categories } = req.body;
    if (!Array.isArray(categories) || !categories.length) {
        return res.status(400).json({ success: false, message: 'categories array required' });
    }
    const total = categories.reduce((s, c) => s + parseFloat(c.percentage || 0), 0);
    if (Math.abs(total - 100) > 0.5) {
        return res.status(400).json({ success: false, message: `Percentages must sum to 100 (got ${total.toFixed(2)})` });
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const cat of categories) {
            await conn.execute(
                `INSERT INTO roster_category_config (session_id, category_name, percentage)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE percentage = VALUES(percentage), updated_at = NOW()`,
                [session_id || null, cat.category_name, parseFloat(cat.percentage)]
            );
        }
        await conn.commit();
        await writeAuditLog(conn, {
            sessionId: session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'CATEGORY_CONFIG_UPDATED', entityType: 'roster_category_config',
            entityId: session_id, newValue: categories, ip: req.ip,
        });
        res.json({ success: true, message: 'Category configuration saved' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// POST /api/roster/merit-list/generate
router.post('/merit-list/generate', verifyToken, isAdmin, async (req, res) => {
    const { session_id } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const sessionFilter = session_id ? 'AND a.session_id = ?' : '';
        const params        = session_id ? [session_id] : [];

        const [apps] = await conn.execute(`
            SELECT
                a.application_id,
                a.applicant_name,
                a.community,
                COALESCE(a.entrance_mark, 0)  AS entrance_mark,
                COALESCE(a.has_integrated, 0) AS has_integrated,
                a.created_at                  AS application_date,
                he_pg.score_value             AS pg_percentage,
                he_pg.score_type              AS pg_score_type,
                he_int.score_value            AS int_percentage,
                he_int.score_type             AS int_score_type
            FROM applications a
            LEFT JOIN higher_education he_pg
                   ON he_pg.application_id = a.application_id
                  AND UPPER(TRIM(he_pg.level)) = 'PG'
            LEFT JOIN higher_education he_int
                   ON he_int.application_id = a.application_id
                  AND UPPER(TRIM(he_int.level)) LIKE '%INTEGRAT%'
            WHERE a.entrance_mark IS NOT NULL
              AND a.entrance_mark > 0
              ${sessionFilter}
            ORDER BY a.application_id
        `, params);

        if (!apps.length) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: session_id
                    ? 'No applications with entrance marks found for this session'
                    : 'No applications with entrance marks found',
            });
        }

        const meritRows = apps.map(app => {
            let qualSource = 'PG';
            let qualPct    = 0;

            if (app.has_integrated && app.int_percentage != null) {
                qualSource = 'INTEGRATED';
                qualPct    = parseFloat(app.int_percentage);
                if (app.int_score_type === 'CGPA') qualPct = Math.min(qualPct * 10, 100);
            } else if (app.pg_percentage != null) {
                qualSource = 'PG';
                qualPct    = parseFloat(app.pg_percentage);
                if (app.pg_score_type === 'CGPA') qualPct = Math.min(qualPct * 10, 100);
            }

            qualPct = Math.max(0, Math.min(100, qualPct));
            const qualScore  = calcQualScore(qualPct);
            const meritScore = calcMeritScore(app.entrance_mark, qualScore);

            return {
                session_id:               session_id || null,
                application_id:           app.application_id,
                applicant_name:           app.applicant_name || '',
                community:                normalizeCategory(app.community),
                entrance_mark:            parseFloat(app.entrance_mark) || 0,
                qualification_source:     qualSource,
                qualification_percentage: qualPct,
                qualification_score:      qualScore,
                final_merit_score:        meritScore,
                application_date:         app.application_date,
            };
        });

        // Tie-break: merit DESC → entrance DESC → qual% DESC → date ASC → id ASC
        meritRows.sort((a, b) => {
            if (b.final_merit_score       !== a.final_merit_score)       return b.final_merit_score - a.final_merit_score;
            if (b.entrance_mark           !== a.entrance_mark)            return b.entrance_mark - a.entrance_mark;
            if (b.qualification_percentage !== a.qualification_percentage) return b.qualification_percentage - a.qualification_percentage;
            if (a.application_date && b.application_date)
                return new Date(a.application_date) - new Date(b.application_date);
            return String(a.application_id).localeCompare(String(b.application_id));
        });
        meritRows.forEach((r, i) => { r.merit_rank = i + 1; });

        if (session_id) {
            await conn.execute('DELETE FROM roster_merit_list WHERE session_id = ?', [session_id]);
        } else {
            await conn.execute('DELETE FROM roster_merit_list WHERE session_id IS NULL');
        }

        for (const r of meritRows) {
            await conn.execute(
                `INSERT INTO roster_merit_list
                 (session_id, application_id, applicant_name, community, entrance_mark,
                  qualification_source, qualification_percentage, qualification_score,
                  final_merit_score, merit_rank, application_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.session_id, r.application_id, r.applicant_name, r.community,
                 r.entrance_mark, r.qualification_source, r.qualification_percentage,
                 r.qualification_score, r.final_merit_score, r.merit_rank, r.application_date]
            );
        }

        await conn.commit();
        await writeAuditLog(conn, {
            sessionId: session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'MERIT_LIST_GENERATED', entityType: 'roster_merit_list',
            entityId: session_id, newValue: { count: meritRows.length, session_id }, ip: req.ip,
        });

        res.json({
            success: true,
            message: `Merit list generated — ${meritRows.length} candidates ranked`,
            count:   meritRows.length,
        });
    } catch (err) {
        await conn.rollback();
        console.error('[Roster] Merit generation error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/roster/merit-list
router.get('/merit-list', verifyToken, isAdmin, async (req, res) => {
    const { session_id, page = 1, limit = 50, search = '', community = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        const where = [], params = [];
        if (session_id) { where.push('session_id = ?');  params.push(session_id); }
        if (community)  { where.push('community = ?');   params.push(community); }
        if (search) {
            where.push('(applicant_name LIKE ? OR application_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM roster_merit_list ${ws}`, params);
        const [rows] = await pool.query(
            `SELECT * FROM roster_merit_list ${ws} ORDER BY merit_rank LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/roster/merit-list/:id
router.put('/merit-list/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { entrance_mark, qualification_percentage, qualification_source } = req.body;
    try {
        const [[ex]] = await pool.query('SELECT * FROM roster_merit_list WHERE id = ?', [id]);
        if (!ex) return res.status(404).json({ success: false, message: 'Record not found' });

        const em  = parseFloat(entrance_mark           ?? ex.entrance_mark);
        const qp  = parseFloat(qualification_percentage ?? ex.qualification_percentage);
        if (em < 0 || em > 70)  return res.status(400).json({ success: false, message: 'entrance_mark must be 0–70' });
        if (qp < 0 || qp > 100) return res.status(400).json({ success: false, message: 'qualification_percentage must be 0–100' });

        const qs  = calcQualScore(qp);
        const ms  = calcMeritScore(em, qs);
        const src = qualification_source || ex.qualification_source;

        await pool.execute(
            `UPDATE roster_merit_list
             SET entrance_mark = ?, qualification_source = ?, qualification_percentage = ?,
                 qualification_score = ?, final_merit_score = ?, updated_at = NOW()
             WHERE id = ?`,
            [em, src, qp, qs, ms, id]
        );

        const [all] = await pool.query(
            `SELECT id FROM roster_merit_list WHERE session_id ${ex.session_id ? '= ?' : 'IS NULL'}
             ORDER BY final_merit_score DESC, entrance_mark DESC, qualification_percentage DESC,
                      application_date ASC, application_id ASC`,
            ex.session_id ? [ex.session_id] : []
        );
        for (let i = 0; i < all.length; i++) {
            await pool.execute('UPDATE roster_merit_list SET merit_rank = ? WHERE id = ?', [i + 1, all[i].id]);
        }

        await writeAuditLog(pool, {
            sessionId: ex.session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'MERIT_MANUAL_UPDATED', entityType: 'roster_merit_list', entityId: id,
            oldValue: { entrance_mark: ex.entrance_mark, qualification_percentage: ex.qualification_percentage },
            newValue: { entrance_mark: em, qualification_percentage: qp, qualification_source: src },
            ip: req.ip,
        });
        res.json({ success: true, message: 'Merit entry updated and ranks recalculated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/roster/allocations/generate
router.post('/allocations/generate', verifyToken, isAdmin, async (req, res) => {
    const { session_id, total_seats } = req.body;
    const seats = parseInt(total_seats);
    if (!seats || seats < 1) {
        return res.status(400).json({ success: false, message: 'total_seats must be >= 1' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [cfgRows] = await conn.execute(
            `SELECT category_name, percentage, session_id AS cfg_sid
             FROM roster_category_config
             WHERE session_id = ? OR session_id IS NULL
             ORDER BY session_id DESC`,
            [session_id || null]
        );
        const categoryConfig = {};
        const seen = new Set();
        for (const r of cfgRows) {
            if (!seen.has(r.category_name)) {
                categoryConfig[r.category_name] = parseFloat(r.percentage);
                seen.add(r.category_name);
            }
        }
        if (!Object.keys(categoryConfig).length) Object.assign(categoryConfig, DEFAULT_CATEGORY_PERCENTAGES);

        const mFilter = session_id ? 'WHERE session_id = ?' : 'WHERE session_id IS NULL';
        const [meritList] = await conn.execute(
            `SELECT * FROM roster_merit_list ${mFilter} ORDER BY merit_rank ASC`,
            session_id ? [session_id] : []
        );

        if (!meritList.length) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Generate the merit list first before allocating roster' });
        }

        const vacancies         = getCategoryVacancies(categoryConfig, seats);
        const originalVacancies = { ...vacancies };
        const conversionLog     = [];

        const entries = meritList.map(candidate => {
            const { allocatedCat, converted, from, to } = getAllocatedCategory(candidate.community, vacancies);
            if (allocatedCat) {
                vacancies[allocatedCat]--;
                if (converted) conversionLog.push({ application_id: candidate.application_id, from, to });
                return { ...candidate, allocated_category: allocatedCat, allocation_status: 'ALLOCATED',
                         is_converted: converted ? 1 : 0, conversion_from: from || null, conversion_to: to || null };
            }
            return { ...candidate, allocated_category: null, allocation_status: 'WAITING',
                     is_converted: 0, conversion_from: null, conversion_to: null };
        });

        let rNum = 1;
        for (const e of entries) {
            e.roster_number = e.allocation_status === 'ALLOCATED' ? rNum++ : null;
        }

        if (session_id) {
            await conn.execute('DELETE FROM roster_entries WHERE session_id = ?', [session_id]);
        } else {
            await conn.execute('DELETE FROM roster_entries WHERE session_id IS NULL');
        }

        for (const e of entries) {
            await conn.execute(
                `INSERT INTO roster_entries
                 (session_id, roster_number, application_id, applicant_name, original_category,
                  allocated_category, entrance_mark, qualification_percentage, qualification_score,
                  final_merit_score, merit_rank, allocation_status, is_converted,
                  conversion_from, conversion_to, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [session_id || null, e.roster_number || null,
                 e.application_id, e.applicant_name, e.community,
                 e.allocated_category, e.entrance_mark, e.qualification_percentage,
                 e.qualification_score, e.final_merit_score, e.merit_rank,
                 e.allocation_status, e.is_converted,
                 e.conversion_from, e.conversion_to, req.user?.id || null]
            );
        }

        await conn.commit();

        const allocated = entries.filter(e => e.allocation_status === 'ALLOCATED').length;
        const waiting   = entries.filter(e => e.allocation_status === 'WAITING').length;

        await writeAuditLog(conn, {
            sessionId: session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'ROSTER_GENERATED', entityType: 'roster_entries', entityId: session_id,
            newValue: { total: entries.length, allocated, waiting, conversions: conversionLog.length, total_seats: seats, vacancies: originalVacancies },
            ip: req.ip,
        });

        res.json({
            success: true,
            message: `Roster generated — ${allocated} allocated, ${waiting} on waiting list`,
            data:    { total: entries.length, allocated, waiting, conversions: conversionLog.length, vacancies: originalVacancies },
        });
    } catch (err) {
        await conn.rollback();
        console.error('[Roster] Allocation error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/roster/allocations
router.get('/allocations', verifyToken, isAdmin, async (req, res) => {
    const { session_id, page = 1, limit = 50, search = '', category = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        const where = [], params = [];
        if (session_id) { where.push('session_id = ?');        params.push(session_id); }
        if (category)   { where.push('original_category = ?'); params.push(category); }
        if (status)     { where.push('allocation_status = ?'); params.push(status); }
        if (search) {
            where.push('(applicant_name LIKE ? OR application_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM roster_entries ${ws}`, params);
        const [rows] = await pool.query(
            `SELECT * FROM roster_entries ${ws} ORDER BY merit_rank ASC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/roster/allocations/:id
router.put('/allocations/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { allocation_status, allocated_category } = req.body;
    try {
        const [[ex]] = await pool.query('SELECT * FROM roster_entries WHERE id = ?', [id]);
        if (!ex) return res.status(404).json({ success: false, message: 'Record not found' });

        const sets = ['updated_at = NOW()'], vals = [];
        if (allocation_status  !== undefined) { sets.push('allocation_status = ?');  vals.push(allocation_status); }
        if (allocated_category !== undefined) { sets.push('allocated_category = ?'); vals.push(allocated_category); }
        vals.push(id);

        await pool.execute(`UPDATE roster_entries SET ${sets.join(', ')} WHERE id = ?`, vals);
        await writeAuditLog(pool, {
            sessionId: ex.session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'ROSTER_MANUAL_UPDATED', entityType: 'roster_entries', entityId: id,
            oldValue: { allocation_status: ex.allocation_status, allocated_category: ex.allocated_category },
            newValue: { allocation_status, allocated_category }, ip: req.ip,
        });
        res.json({ success: true, message: 'Roster entry updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/roster/import/preview
router.post('/import/preview', verifyToken, isAdmin, importUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(req.file.buffer);
        const ws = wb.worksheets[0];
        if (!ws) return res.status(400).json({ success: false, message: 'No worksheet found' });

        const headerMap = {};
        ws.getRow(1).eachCell((cell, col) => {
            const h = String(cell.value || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
            headerMap[h] = col;
        });

        const missing = ['application_id','entrance_mark','qualification_percentage'].filter(h => !headerMap[h]);
        if (missing.length) {
            return res.status(400).json({ success: false, message: `Missing required columns: ${missing.join(', ')}` });
        }

        const get = (row, key) => {
            const col = headerMap[key];
            if (!col) return null;
            const v = row.getCell(col).value;
            return v != null ? String(v).trim() : null;
        };

        const rows = [];
        const seen = new Set();

        ws.eachRow((row, rowNum) => {
            if (rowNum === 1) return;
            const appId = get(row, 'application_id');
            if (!appId) return;

            const entrance   = parseFloat(get(row, 'entrance_mark'));
            const qualPct    = parseFloat(get(row, 'qualification_percentage'));
            const srcRaw     = (get(row, 'qualification_source') || 'PG').toUpperCase();
            const qualSource = srcRaw.includes('INT') ? 'INTEGRATED' : 'PG';
            const community  = get(row, 'community') || get(row, 'category');
            const name       = get(row, 'applicant_name') || get(row, 'name');

            const errs = [];
            if (isNaN(entrance) || entrance < 0 || entrance > 70) errs.push('entrance_mark must be 0–70');
            if (isNaN(qualPct)  || qualPct  < 0 || qualPct  > 100) errs.push('qualification_percentage must be 0–100');
            if (seen.has(appId)) errs.push('Duplicate application_id in file');
            seen.add(appId);

            const qs = !isNaN(qualPct) ? calcQualScore(qualPct) : null;
            const ms = (!isNaN(entrance) && qs !== null) ? calcMeritScore(entrance, qs) : null;

            rows.push({
                rowNum, application_id: appId, applicant_name: name || null,
                community: community ? normalizeCategory(community) : null,
                entrance_mark: isNaN(entrance) ? null : entrance,
                qualification_source: qualSource,
                qualification_percentage: isNaN(qualPct) ? null : qualPct,
                qualification_score: qs, final_merit_score: ms,
                errors: errs, hasError: errs.length > 0,
            });
        });

        res.json({
            success: true,
            data: {
                total:      rows.length,
                valid:      rows.filter(r => !r.hasError).length,
                errorCount: rows.filter(r =>  r.hasError).length,
                rows:       rows.slice(0, 500),
            },
        });
    } catch (err) {
        console.error('[Roster] Import preview error:', err);
        res.status(500).json({ success: false, message: 'Failed to parse file: ' + err.message });
    }
});

// POST /api/roster/import/confirm
router.post('/import/confirm', verifyToken, isAdmin, async (req, res) => {
    const { session_id, rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ success: false, message: 'rows array required' });
    }
    const valid = rows.filter(r => !r.hasError);
    if (!valid.length) return res.status(400).json({ success: false, message: 'No valid rows to import' });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        let imported = 0, updated = 0;

        for (const r of valid) {
            const qs = calcQualScore(r.qualification_percentage);
            const ms = calcMeritScore(r.entrance_mark, qs);
            const [result] = await conn.execute(
                `INSERT INTO roster_merit_list
                 (session_id, application_id, applicant_name, community, entrance_mark,
                  qualification_source, qualification_percentage, qualification_score, final_merit_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   applicant_name           = COALESCE(VALUES(applicant_name), applicant_name),
                   community                = COALESCE(VALUES(community), community),
                   entrance_mark            = VALUES(entrance_mark),
                   qualification_source     = VALUES(qualification_source),
                   qualification_percentage = VALUES(qualification_percentage),
                   qualification_score      = VALUES(qualification_score),
                   final_merit_score        = VALUES(final_merit_score),
                   updated_at               = NOW()`,
                [session_id || null, r.application_id, r.applicant_name || null,
                 r.community || null, r.entrance_mark, r.qualification_source,
                 r.qualification_percentage, qs, ms]
            );
            if (result.affectedRows === 1) imported++; else updated++;
        }

        const rankWhere = session_id ? 'WHERE session_id = ?' : 'WHERE session_id IS NULL';
        const [all] = await conn.execute(
            `SELECT id FROM roster_merit_list ${rankWhere}
             ORDER BY final_merit_score DESC, entrance_mark DESC, qualification_percentage DESC,
                      application_date ASC, application_id ASC`,
            session_id ? [session_id] : []
        );
        for (let i = 0; i < all.length; i++) {
            await conn.execute('UPDATE roster_merit_list SET merit_rank = ? WHERE id = ?', [i + 1, all[i].id]);
        }

        await conn.commit();
        await writeAuditLog(conn, {
            sessionId: session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'EXCEL_IMPORTED', entityType: 'roster_merit_list', entityId: session_id,
            newValue: { imported, updated, total: valid.length }, ip: req.ip,
        });

        res.json({ success: true, message: `Import complete — ${imported} new, ${updated} updated`, imported, updated });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/roster/export
router.get('/export', verifyToken, isAdmin, async (req, res) => {
    const { session_id, type = 'roster', format = 'excel', category = '' } = req.query;
    try {
        let rows, sheetTitle, columns, headerLabels;

        if (type === 'merit') {
            sheetTitle  = 'Merit List';
            const w = session_id ? 'WHERE session_id = ?' : '';
            const p = session_id ? [session_id] : [];
            [rows] = await pool.query(`SELECT * FROM roster_merit_list ${w} ORDER BY merit_rank`, p);
            columns = ['merit_rank','application_id','applicant_name','community',
                       'entrance_mark','qualification_source','qualification_percentage',
                       'qualification_score','final_merit_score'];
            headerLabels = {
                merit_rank:'Merit Rank', application_id:'Application ID', applicant_name:'Candidate Name',
                community:'Category', entrance_mark:'Entrance Mark (/70)',
                qualification_source:'Qual. Source', qualification_percentage:'Qual. %',
                qualification_score:'Qual. Score (/30)', final_merit_score:'Final Merit (/100)',
            };
        } else {
            sheetTitle = category ? `Roster — ${category}` : 'Full Roster';
            const where = [], params = [];
            if (session_id) { where.push('session_id = ?');        params.push(session_id); }
            if (category)   { where.push('original_category = ?'); params.push(category); }
            const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
            [rows] = await pool.query(`SELECT * FROM roster_entries ${ws} ORDER BY merit_rank`, params);
            columns = ['roster_number','merit_rank','application_id','applicant_name',
                       'original_category','allocated_category','entrance_mark',
                       'qualification_percentage','qualification_score','final_merit_score',
                       'allocation_status','is_converted','conversion_from','conversion_to'];
            headerLabels = {
                roster_number:'Roster #', merit_rank:'Merit Rank', application_id:'Application ID',
                applicant_name:'Candidate Name', original_category:'Original Category',
                allocated_category:'Allocated Category', entrance_mark:'Entrance (/70)',
                qualification_percentage:'Qual. %', qualification_score:'Qual. Score (/30)',
                final_merit_score:'Final Merit (/100)', allocation_status:'Status',
                is_converted:'Converted?', conversion_from:'Conv. From', conversion_to:'Conv. To',
            };
        }

        if (format === 'csv') {
            const esc = v => { const s = String(v ?? ''); return s.includes(',') ? `"${s}"` : s; };
            const csv = [
                columns.map(c => esc(headerLabels[c] || c)).join(','),
                ...rows.map(r => columns.map(c => esc(c === 'is_converted' ? (r[c] ? 'Yes' : 'No') : (r[c] ?? ''))).join(','))
            ].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${type}_${Date.now()}.csv"`);
            await writeAuditLog(pool, {
                sessionId: session_id, userId: req.user?.id, userEmail: req.user?.email,
                action: 'EXCEL_EXPORTED', entityType: type, entityId: session_id,
                newValue: { type, format: 'csv', rows: rows.length }, ip: req.ip,
            });
            return res.send(csv);
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = 'PhD ERP — Periyar University';
        wb.created = new Date();
        const wsSheet = wb.addWorksheet(sheetTitle);

        wsSheet.mergeCells(1, 1, 1, columns.length);
        const tc = wsSheet.getCell('A1');
        tc.value     = `Periyar University PhD Admissions — ${sheetTitle}`;
        tc.font      = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        tc.alignment = { horizontal: 'center', vertical: 'middle' };
        tc.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        wsSheet.getRow(1).height = 32;

        wsSheet.mergeCells(2, 1, 2, columns.length);
        const mc = wsSheet.getCell('A2');
        mc.value     = `Generated: ${new Date().toLocaleString('en-IN')}  |  Records: ${rows.length}`;
        mc.font      = { italic: true, size: 10 };
        mc.alignment = { horizontal: 'center' };
        wsSheet.getRow(2).height = 18;

        const hRow = wsSheet.getRow(3);
        columns.forEach((col, i) => {
            const cell = hRow.getCell(i + 1);
            cell.value     = headerLabels[col] || col;
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E4057' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border    = { bottom: { style: 'thin' } };
        });
        hRow.height = 36;

        const WIDTHS = { roster_number:10, merit_rank:10, application_id:18, applicant_name:28,
            community:12, original_category:16, allocated_category:16, entrance_mark:16,
            qualification_source:12, qualification_percentage:12, qualification_score:16,
            final_merit_score:16, allocation_status:14, is_converted:12, conversion_from:14, conversion_to:14 };

        rows.forEach((row, ri) => {
            const dRow = wsSheet.addRow(columns.map(c => c === 'is_converted' ? (row[c] ? 'Yes' : 'No') : (row[c] ?? '')));
            dRow.height = 20;
            const bg = ri % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF';
            dRow.eachCell(cell => {
                cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } };
                cell.alignment = { vertical: 'middle' };
            });
            if (row.is_converted)                   dRow.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFF3CD' } }; });
            if (row.allocation_status === 'WAITING') dRow.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFE2E3E5' } }; });
        });

        columns.forEach((col, i) => { wsSheet.getColumn(i + 1).width = WIDTHS[col] || 14; });
        wsSheet.views     = [{ state: 'frozen', xSplit: 0, ySplit: 3, activeCell: 'A4' }];
        wsSheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_${Date.now()}.xlsx"`);

        await writeAuditLog(pool, {
            sessionId: session_id, userId: req.user?.id, userEmail: req.user?.email,
            action: 'EXCEL_EXPORTED', entityType: type, entityId: session_id,
            newValue: { type, format: 'excel', rows: rows.length }, ip: req.ip,
        });

        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[Roster] Export error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/roster/audit-logs
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    const { session_id, page = 1, limit = 50, search = '', action = '', start_date = '', end_date = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        const where = [], params = [];
        if (session_id) { where.push('session_id = ?');                        params.push(session_id); }
        if (action)     { where.push('action = ?');                             params.push(action); }
        if (search)     { where.push('(user_email LIKE ? OR action LIKE ?)');   params.push(`%${search}%`, `%${search}%`); }
        if (start_date) { where.push('created_at >= ?');                        params.push(start_date + ' 00:00:00'); }
        if (end_date)   { where.push('created_at <= ?');                        params.push(end_date + ' 23:59:59'); }
        const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM roster_audit_log ${ws}`, params);
        const [rows] = await pool.query(
            `SELECT * FROM roster_audit_log ${ws} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
