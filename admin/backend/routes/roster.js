'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// ── Multer: Excel upload storage ─────────────────────────────────────────────
const excelStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../../uploads/roster_imports');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    }
});

const uploadExcel = multer({
    storage: excelStorage,
    fileFilter: (req, file, cb) => {
        if (
            /openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel/.test(file.mimetype) ||
            file.originalname.endsWith('.xlsx')
        ) return cb(null, true);
        cb(new Error('Only Excel (.xlsx) files are allowed'));
    },
    limits: { fileSize: 50 * 1024 * 1024 }
});

// ── Audit Logger ─────────────────────────────────────────────────────────────
async function auditLog(adminId, adminEmail, action, oldValue, newValue, ip, module = 'Roster Management') {
    try {
        await pool.execute(
            `INSERT INTO roster_audit_logs
             (admin_id, admin_email, action, module, old_value, new_value, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                adminId    || null,
                adminEmail || 'system@periyar.edu',
                action,
                module,
                oldValue  ? JSON.stringify(oldValue)  : null,
                newValue  ? JSON.stringify(newValue)  : null,
                ip        || null
            ]
        );
    } catch (e) {
        console.error('Roster audit log error:', e.message);
    }
}

// ── Sync supervisor vacancy from scholars table ───────────────────────────────
async function syncSupervisorVacancy(conn, supervisorId) {
    const [[sup]] = await conn.execute(
        'SELECT max_candidates, max_part_time FROM supervisors WHERE id = ?',
        [supervisorId]
    );
    if (!sup) return;

    const [[{ total_active, pt_active }]] = await conn.execute(
        `SELECT
            COUNT(*) AS total_active,
            SUM(CASE WHEN scholar_type = 'Part-Time' THEN 1 ELSE 0 END) AS pt_active
         FROM scholars
         WHERE supervisor_id = ? AND status = 'Admitted'`,
        [supervisorId]
    );

    const scholars   = total_active || 0;
    const ptScholars = pt_active    || 0;
    const maxCap     = sup.max_candidates || 0;
    const vacancy    = Math.max(0, maxCap - scholars);

    await conn.execute(
        `UPDATE supervisors
         SET current_scholars_count = ?,
             current_part_time_scholars_count = ?,
             current_vacancy = ?
         WHERE id = ?`,
        [scholars, ptScholars, vacancy, supervisorId]
    );
}

// ── Dynamic Vacancy Calculator (pool-aware) ───────────────────────────────────
async function computeVacancyStats(conn, { department_id }) {
    const [supervisors] = await conn.execute(
        `SELECT id, name, max_candidates
         FROM supervisors
         WHERE department_id = ? AND status IN ('Active', 'Approved')`,
        [department_id]
    );

    let totalCapacity  = 0;
    let totalOccupied  = 0;
    let totalVacancy   = 0;
    const supervisorStats = [];

    for (const s of supervisors) {
        const [[{ admitted }]] = await conn.execute(
            `SELECT COUNT(*) AS admitted FROM scholars WHERE supervisor_id = ? AND status = 'Admitted'`,
            [s.id]
        );
        const cap  = s.max_candidates || 0;
        const occ  = admitted         || 0;
        const vac  = Math.max(0, cap - occ);

        totalCapacity += cap;
        totalOccupied += occ;
        totalVacancy  += vac;

        supervisorStats.push({ supervisor_id: s.id, supervisor_name: s.name, capacity: cap, occupied: occ, vacancy: vac });
    }

    return { totalCapacity, totalOccupied, totalVacancy, supervisorStats };
}

// =============================================================================
// SECTION 1 — ROSTER CONFIGURATIONS
// =============================================================================

// GET config for a session (auto-seeds defaults)
router.get('/config/:session_id', verifyToken, isAdmin, async (req, res) => {
    const { session_id } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM roster_configurations WHERE session_id = ?',
            [session_id]
        );
        if (rows.length === 0) {
            await pool.execute(
                `INSERT INTO roster_configurations
                 (session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage)
                 VALUES (?, 70.00, 70.00, 30.00)`,
                [session_id]
            );
            return res.json({
                success: true,
                data: { session_id: parseInt(session_id), pg_eligibility_pct: 70.00, integrated_eligibility_pct: 70.00, merit_percentage: 30.00 }
            });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST/PUT roster configuration
router.post('/config', verifyToken, isAdmin, async (req, res) => {
    const { session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage } = req.body;
    if (!session_id) return res.status(400).json({ success: false, message: 'session_id is required' });

    try {
        const [existing] = await pool.execute(
            'SELECT * FROM roster_configurations WHERE session_id = ?',
            [session_id]
        );

        if (existing.length === 0) {
            await pool.execute(
                `INSERT INTO roster_configurations
                 (session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage)
                 VALUES (?, ?, ?, ?)`,
                [session_id, pg_eligibility_pct ?? 70.00, integrated_eligibility_pct ?? 70.00, merit_percentage ?? 30.00]
            );
        } else {
            await pool.execute(
                `UPDATE roster_configurations
                 SET pg_eligibility_pct = ?, integrated_eligibility_pct = ?, merit_percentage = ?
                 WHERE session_id = ?`,
                [pg_eligibility_pct ?? 70.00, integrated_eligibility_pct ?? 70.00, merit_percentage ?? 30.00, session_id]
            );
        }

        await auditLog(req.user.id, req.user.email, 'UPDATE_ROSTER_CONFIG',
            existing[0] || null,
            { session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage },
            req.ip);

        res.json({ success: true, message: 'Roster configuration saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// SECTION 2 — VACANCY STATS ENGINE
// =============================================================================

router.get('/vacancy-stats', verifyToken, isAdmin, async (req, res) => {
    const { department_id } = req.query;
    if (!department_id) return res.status(400).json({ success: false, message: 'department_id is required' });

    try {
        const stats = await computeVacancyStats(pool, { department_id });

        // Department-wise breakdown for this programme (all departments sharing the programme)
        const [deptBreakdown] = await pool.execute(
            `SELECT d.id AS department_id, d.name AS department_name,
                    COALESCE(SUM(sp.max_candidates), 0)            AS capacity,
                    COALESCE(SUM(sp.current_scholars_count), 0)    AS occupied,
                    COALESCE(SUM(sp.current_vacancy), 0)           AS vacancy
             FROM departments d
             LEFT JOIN supervisors sp
               ON sp.department_id = d.id AND sp.status IN ('Active','Approved')
             WHERE d.id = ?
             GROUP BY d.id, d.name`,
            [department_id]
        );

        res.json({
            success: true,
            data: {
                totalCapacity:       stats.totalCapacity,
                totalOccupied:       stats.totalOccupied,
                totalVacancy:        stats.totalVacancy,
                supervisorBreakdown: stats.supervisorStats,
                departmentBreakdown: deptBreakdown
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// SECTION 3 — CORE RECALCULATION ENGINE
// =============================================================================

router.post('/recalculate', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id } = req.body;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // ── 1. Session Config ──────────────────────────────────────────────────
        const [[cfg]] = await conn.execute(
            'SELECT pg_eligibility_pct, integrated_eligibility_pct, merit_percentage FROM roster_configurations WHERE session_id = ?',
            [session_id]
        );
        const pgThreshold  = cfg ? parseFloat(cfg.pg_eligibility_pct)         : 70.00;
        const intThreshold = cfg ? parseFloat(cfg.integrated_eligibility_pct) : 70.00;
        const meritPct     = cfg ? parseFloat(cfg.merit_percentage)            : 30.00;

        // ── 2. Dynamic Vacancy ─────────────────────────────────────────────────
        const vacStats       = await computeVacancyStats(conn, { department_id });
        const totalVacancies = vacStats.totalVacancy;

        // ── 3. Fetch Approved Applicants ───────────────────────────────────────
        const [applicants] = await conn.execute(
            `SELECT
                a.application_id,
                COALESCE(a.applicant_name, u.full_name) AS applicant_name,
                a.community,
                a.entrance_mark,
                a.has_integrated,
                a.has_pg,
                a.allotted_supervisor_id
             FROM applications a
             JOIN users u ON a.user_id = u.id
             WHERE a.session_id = ?
               AND a.program_offered_id = ?
               AND a.status = 'Approved'`,
            [session_id, program_id]
        );

        const poolCandidates = [];

        // ── 4. Score Computation ───────────────────────────────────────────────
        for (const app of applicants) {
            // Qualifying degree: PG or Integrated, never both
            const [qualRows] = await conn.execute(
                `SELECT score_value, level
                 FROM higher_education
                 WHERE application_id = ? AND level IN ('PG', 'Integrated')
                 ORDER BY FIELD(level, 'Integrated', 'PG') ASC
                 LIMIT 1`,
                [app.application_id]
            );

            let degreeType = app.has_integrated ? 'Integrated' : 'PG';
            let scoreValue = 0;

            if (qualRows.length > 0) {
                degreeType = qualRows[0].level;
                scoreValue = parseFloat(qualRows[0].score_value) || 0;
            } else {
                // Fallback: applications.score_value
                const [[fb]] = await conn.execute(
                    'SELECT score_value FROM applications WHERE application_id = ?',
                    [app.application_id]
                );
                if (fb) scoreValue = parseFloat(fb.score_value) || 0;
            }

            const threshold = degreeType === 'Integrated' ? intThreshold : pgThreshold;
            const isExcluded = scoreValue < threshold ? 1 : 0;
            const exclusionReason = isExcluded
                ? `${degreeType} score ${scoreValue.toFixed(2)}% is below the required ${threshold}% eligibility threshold.`
                : null;

            // Academic Weightage: (score / 100) × 20, max 20 marks
            const academicWeightage = parseFloat(((scoreValue / 100) * 20).toFixed(2));
            // Entrance Exam max 70 marks (from existing module — not modified)
            const entranceMark      = parseFloat(app.entrance_mark) || 0;
            // Final Score max 90 marks
            const finalScore        = parseFloat((entranceMark + academicWeightage).toFixed(2));

            poolCandidates.push({
                application_id:         app.application_id,
                applicant_name:         app.applicant_name,
                community:              app.community || 'OC',
                score_value:            scoreValue,
                entrance_mark:          entranceMark,
                academic_weightage:     academicWeightage,
                final_score:            finalScore,
                degree_type:            degreeType,
                is_excluded:            isExcluded,
                exclusion_reason:       exclusionReason,
                allotted_supervisor_id: app.allotted_supervisor_id || null
            });
        }

        // ── 5. Split Eligible / Excluded ───────────────────────────────────────
        const eligibleList = poolCandidates.filter(c => !c.is_excluded);
        const excludedList = poolCandidates.filter(c =>  c.is_excluded);

        // Sort: Final Score DESC → Entrance Mark DESC → Degree % DESC
        eligibleList.sort((a, b) => {
            if (b.final_score   !== a.final_score)   return b.final_score   - a.final_score;
            if (b.entrance_mark !== a.entrance_mark) return b.entrance_mark - a.entrance_mark;
            return b.score_value - a.score_value;
        });

        // ── 6. Merit Allocation ────────────────────────────────────────────────
        const meritSeatsLimit = Math.round(totalVacancies * meritPct / 100);
        const selectedMerit   = [];
        const meritWaiting    = [];

        eligibleList.forEach((c, i) => {
            if (i < meritSeatsLimit) {
                c.allotted_seat_type = 'Merit';
                c.allotted_category  = 'Merit';
                c.selection_status   = 'Selected';
                selectedMerit.push(c);
            } else {
                meritWaiting.push(c);
            }
        });

        // ── 7. Community Reservation Allocation ───────────────────────────────
        const remainingSeats = Math.max(0, totalVacancies - selectedMerit.length);

        const [communities] = await conn.execute(
            `SELECT community_name, roster_percentage
             FROM community_fees
             WHERE status = 'active' AND roster_percentage > 0
             ORDER BY id ASC`
        );

        const selectedRes       = [];
        const commWaitPool      = {};
        const selectedIds       = new Set(selectedMerit.map(c => c.application_id));

        // Group non-merit eligible by community
        meritWaiting.forEach(c => {
            if (!commWaitPool[c.community]) commWaitPool[c.community] = [];
            commWaitPool[c.community].push(c);
        });

        communities.forEach(comm => {
            const seats = Math.round(remainingSeats * (parseFloat(comm.roster_percentage) / 100));
            const pool  = commWaitPool[comm.community_name] || [];
            pool.forEach((cand, idx) => {
                if (idx < seats) {
                    cand.allotted_seat_type = 'Reservation';
                    cand.allotted_category  = comm.community_name;
                    cand.selection_status   = 'Selected';
                    selectedRes.push(cand);
                    selectedIds.add(cand.application_id);
                }
            });
        });

        // ── 8. Waiting List ───────────────────────────────────────────────────
        const waitingPool = eligibleList.filter(c => !selectedIds.has(c.application_id));
        waitingPool.forEach(c => {
            c.selection_status   = 'Waiting';
            c.allotted_seat_type = null;
            c.allotted_category  = null;
        });

        // ── 9. Assign Ranks ────────────────────────────────────────────────────
        selectedMerit.forEach((c, i) => {
            c.merit_rank       = i + 1;
            c.reservation_rank = null;
        });

        const resCounters = {};
        selectedRes.forEach(c => {
            resCounters[c.community] = (resCounters[c.community] || 0) + 1;
            c.reservation_rank = resCounters[c.community];
            c.merit_rank       = null;
        });

        waitingPool.forEach((c, i) => {
            c.merit_rank = i + 1;
            const commWait = waitingPool.filter(w => w.community === c.community);
            c.reservation_rank = commWait.indexOf(c) + 1;
        });

        excludedList.forEach(c => {
            c.selection_status   = 'Not Selected';
            c.allotted_seat_type = null;
            c.allotted_category  = null;
            c.merit_rank         = null;
            c.reservation_rank   = null;
        });

        // ── 10. Persist to Database ────────────────────────────────────────────
        const allCandidates = [...selectedMerit, ...selectedRes, ...waitingPool, ...excludedList];

        if (allCandidates.length > 0) {
            const placeholders = allCandidates.map(() => '?').join(',');
            await conn.execute(
                `DELETE FROM roster_allocations WHERE application_id IN (${placeholders})`,
                allCandidates.map(c => c.application_id)
            );

            for (const cand of allCandidates) {
                const rosterStatus = cand.selection_status === 'Selected' ? 'Selected' : 'Waiting';
                await conn.execute(
                    `INSERT INTO roster_allocations
                     (application_id, academic_weightage, final_score, merit_rank, reservation_rank,
                      selection_status, roster_status, allotted_seat_type, allotted_category,
                      allotted_supervisor_id, is_excluded, exclusion_reason)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        cand.application_id,
                        cand.academic_weightage,
                        cand.final_score,
                        cand.merit_rank           || null,
                        cand.reservation_rank     || null,
                        cand.selection_status,
                        rosterStatus,
                        cand.allotted_seat_type   || null,
                        cand.allotted_category    || null,
                        cand.allotted_supervisor_id || null,
                        cand.is_excluded,
                        cand.exclusion_reason     || null
                    ]
                );
            }
        }

        await conn.commit();

        await auditLog(req.user.id, req.user.email, 'ROSTER_RECALCULATED', null, {
            session_id, program_id, department_id,
            total_vacancies: totalVacancies,
            merit_seats:     meritSeatsLimit,
            selected:        selectedMerit.length + selectedRes.length,
            waiting:         waitingPool.length,
            excluded:        excludedList.length,
            processed:       allCandidates.length
        }, req.ip);

        res.json({
            success: true,
            message: 'Roster recalculation completed successfully',
            summary: {
                totalVacancies,
                meritSeats:  meritSeatsLimit,
                selected:    selectedMerit.length + selectedRes.length,
                waiting:     waitingPool.length,
                excluded:    excludedList.length,
                processed:   allCandidates.length
            }
        });
    } catch (err) {
        await conn.rollback();
        console.error('Roster recalculation error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SECTION 4 — ROSTER SELECTION LIST
// =============================================================================

router.get('/list', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id, supervisor_id, community, status } = req.query;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    try {
        let sql = `
            SELECT
                a.application_id,
                COALESCE(a.applicant_name, u.full_name) AS applicant_name,
                a.community,
                a.entrance_mark,
                a.mobile,
                a.gender,
                ra.academic_weightage,
                ra.final_score,
                ra.merit_rank,
                ra.reservation_rank,
                ra.selection_status,
                ra.roster_status,
                ra.allotted_seat_type,
                ra.allotted_category,
                ra.allotted_supervisor_id,
                ra.is_excluded,
                ra.exclusion_reason,
                sup.name  AS allotted_supervisor_name,
                po.name   AS programme_name,
                d.name    AS department_name,
                he.score_value AS degree_percentage,
                he.level       AS degree_type
            FROM applications a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN roster_allocations ra ON a.application_id = ra.application_id
            LEFT JOIN supervisors sup ON ra.allotted_supervisor_id = sup.id
            LEFT JOIN programs_offered po ON a.program_offered_id  = po.id
            LEFT JOIN departments d       ON a.department_id       = d.id
            LEFT JOIN higher_education he ON (
                a.application_id = he.application_id
                AND he.level IN ('PG','Integrated')
            )
            WHERE a.session_id = ?
              AND a.program_offered_id = ?
              AND a.department_id = ?
        `;
        const params = [session_id, program_id, department_id];

        if (supervisor_id && supervisor_id !== 'all') {
            sql += ' AND ra.allotted_supervisor_id = ?';
            params.push(supervisor_id);
        }
        if (community && community !== 'all') {
            sql += ' AND a.community = ?';
            params.push(community);
        }
        if (status && status !== 'all') {
            sql += ' AND ra.selection_status = ?';
            params.push(status);
        }

        sql += ' ORDER BY ra.is_excluded ASC, COALESCE(ra.final_score, 0) DESC, ra.merit_rank ASC';

        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// SECTION 5 — AUTO REPLACEMENT ENGINE
// =============================================================================

router.put('/status/:application_id', verifyToken, isAdmin, async (req, res) => {
    const { application_id } = req.params;
    const { roster_status }  = req.body;

    const RELEASED_STATES = ['Rejected', 'No Show', 'Verification Failed', 'Withdrawn', 'Cancelled'];
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [[alloc]] = await conn.execute(
            `SELECT ra.*, a.session_id, a.program_offered_id, a.department_id, a.community,
                    COALESCE(a.applicant_name, u.full_name) AS applicant_name
             FROM roster_allocations ra
             JOIN applications a ON ra.application_id = a.application_id
             JOIN users u ON a.user_id = u.id
             WHERE ra.application_id = ?`,
            [application_id]
        );

        if (!alloc) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Roster allocation record not found' });
        }

        const oldStatus   = alloc.roster_status;
        const wasSelected = alloc.selection_status === 'Selected';

        // Update status
        await conn.execute(
            'UPDATE roster_allocations SET roster_status = ?, updated_at = NOW() WHERE application_id = ?',
            [roster_status, application_id]
        );

        let promotionDetails = null;

        // ── Auto-Replacement: released seat → promote next eligible candidate ─
        if (wasSelected && RELEASED_STATES.includes(roster_status)) {
            await conn.execute(
                `UPDATE roster_allocations
                 SET selection_status = 'Not Selected', merit_rank = NULL, reservation_rank = NULL
                 WHERE application_id = ?`,
                [application_id]
            );

            const seatType = alloc.allotted_seat_type;
            const category = alloc.allotted_category;

            let nextQuery = `
                SELECT ra.application_id,
                       COALESCE(a.applicant_name, u.full_name) AS applicant_name,
                       a.community
                FROM roster_allocations ra
                JOIN applications a ON ra.application_id = a.application_id
                JOIN users u ON a.user_id = u.id
                WHERE a.session_id = ?
                  AND a.program_offered_id = ?
                  AND a.department_id = ?
                  AND ra.selection_status = 'Waiting'
                  AND ra.is_excluded = 0
            `;
            const qParams = [alloc.session_id, alloc.program_offered_id, alloc.department_id];

            // Reservation seat → same community only
            if (seatType === 'Reservation') {
                nextQuery += ' AND a.community = ?';
                qParams.push(alloc.community);
            }

            nextQuery += ' ORDER BY ra.final_score DESC, ra.created_at ASC LIMIT 1';
            const [[nextCand]] = await conn.execute(nextQuery, qParams);

            if (nextCand) {
                await conn.execute(
                    `UPDATE roster_allocations
                     SET selection_status = 'Selected',
                         roster_status    = 'Selected',
                         allotted_seat_type = ?,
                         allotted_category  = ?,
                         updated_at         = NOW()
                     WHERE application_id = ?`,
                    [seatType, category, nextCand.application_id]
                );

                promotionDetails = {
                    released_application_id: application_id,
                    released_name:           alloc.applicant_name,
                    promoted_application_id: nextCand.application_id,
                    promoted_name:           nextCand.applicant_name,
                    seat_type:               seatType,
                    category
                };

                await auditLog(req.user.id, req.user.email, 'AUTO_REPLACEMENT',
                    { released: application_id, quota: category },
                    { promoted: nextCand.application_id, name: nextCand.applicant_name },
                    req.ip);
            }
        }

        await conn.commit();

        await auditLog(req.user.id, req.user.email, 'UPDATE_ROSTER_STATUS',
            { application_id, roster_status: oldStatus },
            { application_id, roster_status, promotion: promotionDetails },
            req.ip);

        res.json({ success: true, message: 'Status updated successfully', promoted: promotionDetails });
    } catch (err) {
        await conn.rollback();
        console.error('Status update error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SECTION 6 — SUPERVISOR ALLOCATION
// =============================================================================

router.put('/allocate-supervisor/:application_id', verifyToken, isAdmin, async (req, res) => {
    const { application_id } = req.params;
    const { supervisor_id }  = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[alloc]] = await conn.execute(
            'SELECT * FROM roster_allocations WHERE application_id = ?',
            [application_id]
        );
        if (!alloc) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Roster record not found' });
        }

        if (supervisor_id) {
            const [[sup]] = await conn.execute(
                'SELECT current_vacancy, name FROM supervisors WHERE id = ?',
                [supervisor_id]
            );
            if (!sup) {
                await conn.rollback();
                return res.status(404).json({ success: false, message: 'Supervisor not found' });
            }
            if (sup.current_vacancy <= 0 && alloc.allotted_supervisor_id !== parseInt(supervisor_id)) {
                await conn.rollback();
                return res.status(400).json({ success: false, message: `Supervisor ${sup.name} has no available vacancy` });
            }
        }

        await conn.execute(
            'UPDATE roster_allocations SET allotted_supervisor_id = ?, updated_at = NOW() WHERE application_id = ?',
            [supervisor_id || null, application_id]
        );
        await conn.execute(
            'UPDATE applications SET allotted_supervisor_id = ?, updated_at = NOW() WHERE application_id = ?',
            [supervisor_id || null, application_id]
        );

        await conn.commit();

        await auditLog(req.user.id, req.user.email, 'ALLOCATE_SUPERVISOR',
            { application_id, old_supervisor: alloc.allotted_supervisor_id },
            { application_id, new_supervisor: supervisor_id },
            req.ip);

        res.json({ success: true, message: 'Supervisor allocated successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SECTION 7 — EXCEL EXPORT ENGINE
// =============================================================================

router.get('/export', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id, supervisor_id, community, status } = req.query;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    try {
        let sql = `
            SELECT
                a.application_id,
                COALESCE(a.applicant_name, u.full_name) AS applicant_name,
                u.email,
                a.mobile,
                a.gender,
                a.community,
                a.entrance_mark,
                ra.academic_weightage,
                ra.final_score,
                ra.merit_rank,
                ra.reservation_rank,
                ra.selection_status,
                ra.roster_status,
                ra.allotted_seat_type,
                ra.allotted_category,
                ra.is_excluded,
                ra.exclusion_reason,
                sup.name  AS allotted_supervisor_name,
                po.name   AS programme_name,
                d.name    AS department_name,
                he.score_value AS degree_percentage,
                he.level       AS degree_type
            FROM applications a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN roster_allocations ra ON a.application_id = ra.application_id
            LEFT JOIN supervisors sup ON ra.allotted_supervisor_id = sup.id
            LEFT JOIN programs_offered po ON a.program_offered_id  = po.id
            LEFT JOIN departments d       ON a.department_id       = d.id
            LEFT JOIN higher_education he ON (
                a.application_id = he.application_id AND he.level IN ('PG','Integrated')
            )
            WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
        `;
        const params = [session_id, program_id, department_id];

        if (supervisor_id && supervisor_id !== 'all') { sql += ' AND ra.allotted_supervisor_id = ?'; params.push(supervisor_id); }
        if (community    && community    !== 'all')    { sql += ' AND a.community = ?';               params.push(community); }
        if (status       && status       !== 'all')    { sql += ' AND ra.selection_status = ?';       params.push(status); }

        sql += ' ORDER BY ra.is_excluded ASC, COALESCE(ra.final_score,0) DESC, ra.merit_rank ASC';

        const [rows] = await pool.execute(sql, params);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Periyar University ERP';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Roster Allocations', {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
        });

        // Title rows
        sheet.addRow([]);
        const t1 = sheet.addRow(['PERIYAR UNIVERSITY — Ph.D ADMISSION ERP — DYNAMIC ROSTER ALLOCATION LEDGER']);
        t1.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
        t1.getCell(1).alignment = { horizontal: 'center' };
        sheet.mergeCells('A2:T2');

        if (rows.length > 0) {
            const meta = sheet.addRow([
                `Programme: ${rows[0].programme_name || '—'} | Department: ${rows[0].department_name || '—'} | Exported: ${new Date().toLocaleString('en-IN')}`
            ]);
            meta.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF555555' } };
            sheet.mergeCells('A3:T3');
        }
        sheet.addRow([]);

        const HEADERS = [
            'S.No', 'Application ID', 'Applicant Name', 'Email', 'Mobile', 'Gender', 'Community',
            'Degree Category', 'Qualifying %',
            'Academic Weightage\n(Qual%÷100×20, Max 20)',
            'Entrance Marks\n(Max 70)',
            'Final Score\n(Max 90)',
            'Merit Rank', 'Reservation Rank',
            'Seat Type', 'Quota / Category',
            'Selection Status', 'Roster Admin Status',
            'Allotted Supervisor',
            'Exclusion Reason'
        ];

        const hRow = sheet.addRow(HEADERS);
        hRow.height = 36;
        hRow.eachCell(cell => {
            cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border    = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });

        rows.forEach((r, idx) => {
            const fillColor = r.is_excluded
                ? 'FFFDE8E8'
                : (idx % 2 === 0 ? 'FFF0F6FF' : 'FFFFFFFF');

            const dRow = sheet.addRow([
                idx + 1,
                r.application_id,
                r.applicant_name         || '—',
                r.email                  || '—',
                r.mobile                 || '—',
                r.gender                 || '—',
                r.community              || '—',
                r.degree_type            || 'PG',
                r.degree_percentage      ? parseFloat(r.degree_percentage)  : 0,
                r.academic_weightage     ? parseFloat(r.academic_weightage) : 0,
                r.entrance_mark          ? parseFloat(r.entrance_mark)      : 0,
                r.final_score            ? parseFloat(r.final_score)        : 0,
                r.merit_rank             || '—',
                r.reservation_rank       || '—',
                r.allotted_seat_type     || 'Unallotted',
                r.allotted_category      || '—',
                r.selection_status       || 'Not Selected',
                r.roster_status          || '—',
                r.allotted_supervisor_name || '—',
                r.exclusion_reason       || '—'
            ]);

            dRow.height = 20;
            dRow.eachCell(cell => {
                cell.font      = { size: 9 };
                cell.alignment = { vertical: 'middle', wrapText: false };
                cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                cell.border    = {
                    top:   { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    bottom:{ style: 'thin', color: { argb: 'FFE0E0E0' } },
                    left:  { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                };
            });
        });

        // Column widths
        const colWidths = [5,16,26,28,13,8,10,12,10,14,12,12,10,12,12,14,14,14,26,30];
        sheet.columns.forEach((col, i) => { col.width = colWidths[i] || 14; });

        // Summary row
        sheet.addRow([]);
        const sumRow = sheet.addRow([
            '', `Total: ${rows.length}`,
            `Selected: ${rows.filter(r => r.selection_status === 'Selected').length}`,
            `Waiting: ${rows.filter(r => r.selection_status === 'Waiting').length}`,
            `Excluded: ${rows.filter(r => r.is_excluded).length}`
        ]);
        sumRow.eachCell(cell => { cell.font = { bold: true, size: 9 }; });

        await auditLog(req.user.id, req.user.email, 'EXPORT_ROSTER_EXCEL', null,
            { session_id, program_id, department_id, rows_exported: rows.length }, req.ip);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="roster_export_${Date.now()}.xlsx"`);
        res.send(await workbook.xlsx.writeBuffer());
    } catch (err) {
        res.status(500).json({ success: false, message: 'Export failed: ' + err.message });
    }
});

// =============================================================================
// SECTION 8 — EXCEL IMPORT ENGINE
// =============================================================================

router.post('/import', verifyToken, isAdmin, uploadExcel.single('excel'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No Excel file uploaded' });
    const { session_id, program_id, department_id } = req.body;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    const filePath = req.file.path;
    const conn     = await pool.getConnection();
    let total = 0, updated = 0, skipped = 0, failed = 0;
    const errors           = [];
    const updatesPerformed = [];

    try {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(filePath);
        const sheet = wb.getWorksheet(1);
        if (!sheet) throw new Error('No worksheet found in uploaded file');

        await conn.beginTransaction();

        // Data starts at row 6 (rows 1-4 = title/meta/blank/header, row 5 = header labels)
        // Column map from export:
        // 1=SNo, 2=AppID, 3=Name, 4=Email, 5=Mobile, 6=Gender, 7=Community,
        // 8=DegCat, 9=Deg%, 10=AcadWt, 11=EntranceMark, 12=FinalScore,
        // 13=MeritRank, 14=ResRank, 15=SeatType, 16=QuotaCat,
        // 17=SelectStatus, 18=RosterStatus, 19=Supervisor, 20=ExclusionReason
        for (let i = 6; i <= sheet.rowCount; i++) {
            const row   = sheet.getRow(i);
            const appId = row.getCell(2).value ? String(row.getCell(2).value).trim() : null;
            if (!appId || appId === 'Application ID') continue;

            total++;
            try {
                const [[app]] = await conn.execute(
                    `SELECT application_id, has_integrated FROM applications
                     WHERE application_id = ? AND session_id = ? AND program_offered_id = ?`,
                    [appId, session_id, program_id]
                );
                if (!app) {
                    failed++;
                    errors.push({ row: i, id: appId, error: 'Applicant not found in the selected programme scope.' });
                    continue;
                }

                let isDirty = false;
                const changes = {};

                // ── Col 11: Entrance Mark ──────────────────────────────────────
                const emRaw = row.getCell(11).value;
                if (emRaw !== null && emRaw !== undefined && String(emRaw).trim() !== '' && String(emRaw).trim() !== '—') {
                    const em = parseFloat(emRaw);
                    if (isNaN(em) || em < 0 || em > 70) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Entrance mark '${emRaw}' is invalid (must be 0–70).` });
                        continue;
                    }
                    const [[ex]] = await conn.execute('SELECT entrance_mark FROM applications WHERE application_id = ?', [appId]);
                    if (ex && parseFloat(ex.entrance_mark) !== em) {
                        await conn.execute('UPDATE applications SET entrance_mark = ?, updated_at = NOW() WHERE application_id = ?', [em, appId]);
                        isDirty = true;
                        changes.entrance_mark = { old: ex.entrance_mark, new: em };
                    }
                }

                // ── Col 9: Degree Percentage ───────────────────────────────────
                const dpRaw = row.getCell(9).value;
                if (dpRaw !== null && dpRaw !== undefined && String(dpRaw).trim() !== '' && String(dpRaw).trim() !== '—') {
                    const dp = parseFloat(dpRaw);
                    if (isNaN(dp) || dp < 0 || dp > 100) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Degree percentage '${dpRaw}' is invalid (must be 0–100).` });
                        continue;
                    }
                    const degLevel = app.has_integrated ? 'Integrated' : 'PG';
                    const [[exQ]] = await conn.execute(
                        'SELECT score_value FROM higher_education WHERE application_id = ? AND level = ?',
                        [appId, degLevel]
                    );
                    if (exQ && parseFloat(exQ.score_value) !== dp) {
                        await conn.execute(
                            'UPDATE higher_education SET score_value = ? WHERE application_id = ? AND level = ?',
                            [dp, appId, degLevel]
                        );
                        isDirty = true;
                        changes.degree_percentage = { old: exQ.score_value, new: dp };
                    }
                }

                // ── Col 19: Allotted Supervisor ────────────────────────────────
                const supRaw = row.getCell(19).value;
                if (supRaw && String(supRaw).trim() !== '—') {
                    const supName = String(supRaw).trim();
                    const [[sup]] = await conn.execute(
                        'SELECT id, current_vacancy FROM supervisors WHERE name = ? AND department_id = ?',
                        [supName, department_id]
                    );
                    if (!sup) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Supervisor "${supName}" not found in this department.` });
                        continue;
                    }
                    const [[exA]] = await conn.execute('SELECT allotted_supervisor_id FROM roster_allocations WHERE application_id = ?', [appId]);
                    if (!exA || exA.allotted_supervisor_id !== sup.id) {
                        if (sup.current_vacancy <= 0 && exA?.allotted_supervisor_id !== sup.id) {
                            failed++;
                            errors.push({ row: i, id: appId, error: `Supervisor "${supName}" has no available vacancy.` });
                            continue;
                        }
                        await conn.execute('UPDATE roster_allocations SET allotted_supervisor_id = ? WHERE application_id = ?', [sup.id, appId]);
                        await conn.execute('UPDATE applications SET allotted_supervisor_id = ? WHERE application_id = ?', [sup.id, appId]);
                        isDirty = true;
                        changes.supervisor = { old: exA?.allotted_supervisor_id, new: sup.id };
                    }
                }

                // ── Col 18: Roster Admin Status ────────────────────────────────
                const rsRaw = row.getCell(18).value;
                if (rsRaw && String(rsRaw).trim() !== '—') {
                    const rs = String(rsRaw).trim();
                    const VALID = ['Selected','Waiting','Joined','Rejected','No Show','Verification Failed','Withdrawn','Cancelled'];
                    if (!VALID.includes(rs)) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Roster status "${rs}" is not a valid value.` });
                        continue;
                    }
                    const [[exR]] = await conn.execute('SELECT roster_status FROM roster_allocations WHERE application_id = ?', [appId]);
                    if (exR && exR.roster_status !== rs) {
                        await conn.execute('UPDATE roster_allocations SET roster_status = ? WHERE application_id = ?', [rs, appId]);
                        isDirty = true;
                        changes.roster_status = { old: exR.roster_status, new: rs };
                    }
                }

                if (isDirty) {
                    updated++;
                    updatesPerformed.push({ application_id: appId, changes });
                } else {
                    skipped++;
                }
            } catch (rowErr) {
                failed++;
                errors.push({ row: i, id: appId, error: rowErr.message });
            }
        }

        await conn.commit();

        // Trigger recalculation after import
        if (updated > 0) {
            try {
                const recRes = await fetch(
                    `http://localhost:${process.env.ADMIN_BACKEND_PORT || 5001}/api/roster/recalculate`,
                    {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
                        body:    JSON.stringify({ session_id, program_id, department_id })
                    }
                );
                const recJson = await recRes.json();
                if (!recJson.success) console.error('Post-import recalculation warning:', recJson.message);
            } catch (recErr) {
                console.error('Post-import recalculation error:', recErr.message);
            }
        }

        await auditLog(req.user.id, req.user.email, 'IMPORT_ROSTER_EXCEL', null,
            { total, updated, skipped, failed, error_count: errors.length }, req.ip);

        try { fs.unlinkSync(filePath); } catch (_) {}

        res.json({ success: true, total, updated, skipped, failed, errors });
    } catch (err) {
        await conn.rollback();
        try { fs.unlinkSync(filePath); } catch (_) {}
        console.error('Roster import error:', err);
        res.status(500).json({ success: false, message: 'Import failed: ' + err.message });
    } finally {
        conn.release();
    }
});

// =============================================================================
// SECTION 9 — DASHBOARD ANALYTICS
// =============================================================================

router.get('/analytics', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id } = req.query;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    try {
        const [[{ total_applicants }]] = await pool.execute(
            `SELECT COUNT(*) AS total_applicants FROM applications
             WHERE session_id = ? AND program_offered_id = ? AND status = 'Approved'`,
            [session_id, program_id]
        );

        const [[{ eligible, ineligible }]] = await pool.execute(
            `SELECT
                SUM(CASE WHEN ra.is_excluded = 0 THEN 1 ELSE 0 END) AS eligible,
                SUM(CASE WHEN ra.is_excluded = 1 THEN 1 ELSE 0 END) AS ineligible
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?`,
            [session_id, program_id, department_id]
        );

        const [[{ selected, waiting }]] = await pool.execute(
            `SELECT
                SUM(CASE WHEN ra.selection_status = 'Selected' THEN 1 ELSE 0 END) AS selected,
                SUM(CASE WHEN ra.selection_status = 'Waiting'  THEN 1 ELSE 0 END) AS waiting
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?`,
            [session_id, program_id, department_id]
        );

        const [[{ merit_seats, reservation_seats }]] = await pool.execute(
            `SELECT
                SUM(CASE WHEN ra.allotted_seat_type = 'Merit'       THEN 1 ELSE 0 END) AS merit_seats,
                SUM(CASE WHEN ra.allotted_seat_type = 'Reservation' THEN 1 ELSE 0 END) AS reservation_seats
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
               AND ra.selection_status = 'Selected'`,
            [session_id, program_id, department_id]
        );

        const [[{ joined }]] = await pool.execute(
            `SELECT COUNT(*) AS joined FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
               AND ra.roster_status = 'Joined'`,
            [session_id, program_id, department_id]
        );

        const vacStats = await computeVacancyStats(pool, { department_id });

        const [communityDistribution] = await pool.execute(
            `SELECT a.community, COUNT(*) AS count
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
               AND ra.selection_status = 'Selected'
             GROUP BY a.community ORDER BY count DESC`,
            [session_id, program_id, department_id]
        );

        const [supervisorDistribution] = await pool.execute(
            `SELECT sup.name AS supervisor_name, COUNT(*) AS count, sup.current_vacancy AS vacancy
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             JOIN supervisors sup ON ra.allotted_supervisor_id = sup.id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
               AND ra.selection_status = 'Selected'
             GROUP BY sup.id, sup.name, sup.current_vacancy
             ORDER BY count DESC`,
            [session_id, program_id, department_id]
        );

        const [departmentDistribution] = await pool.execute(
            `SELECT d.name AS department_name, COUNT(*) AS count
             FROM applications a
             JOIN departments d ON a.department_id = d.id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.status = 'Approved'
             GROUP BY d.id, d.name`,
            [session_id, program_id]
        );

        res.json({
            success: true,
            data: {
                totalApplicants:      total_applicants  || 0,
                eligibleApplicants:   eligible          || 0,
                ineligibleApplicants: ineligible        || 0,
                totalVacancies:       vacStats.totalVacancy,
                totalCapacity:        vacStats.totalCapacity,
                totalOccupied:        vacStats.totalOccupied,
                meritSeats:           merit_seats        || 0,
                reservationSeats:     reservation_seats  || 0,
                selectedCandidates:   selected           || 0,
                waitingCandidates:    waiting            || 0,
                joinedCandidates:     joined             || 0,
                communityDistribution,
                supervisorDistribution,
                departmentDistribution,
                supervisorBreakdown: vacStats.supervisorStats
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// SECTION 10 — AUDIT LOGS
// =============================================================================

router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    const { search, start_date, end_date, limit = 200 } = req.query;
    try {
        let sql    = 'SELECT * FROM roster_audit_logs WHERE 1=1';
        const params = [];

        if (start_date) { sql += ' AND created_at >= ?'; params.push(start_date + ' 00:00:00'); }
        if (end_date)   { sql += ' AND created_at <= ?'; params.push(end_date   + ' 23:59:59'); }
        if (search && search.trim()) {
            const like = `%${search.trim()}%`;
            sql += ' AND (admin_email LIKE ? OR action LIKE ? OR old_value LIKE ? OR new_value LIKE ?)';
            params.push(like, like, like, like);
        }

        sql += ` ORDER BY created_at DESC LIMIT ${Math.min(parseInt(limit) || 200, 500)}`;
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================================================
// SECTION 11 — SCHOLAR MANAGEMENT
// =============================================================================

// GET scholars
router.get('/scholars', verifyToken, isAdmin, async (req, res) => {
    const { supervisor_id, programme_id, department_id, search } = req.query;
    try {
        let sql = `
            SELECT sc.*, sup.name AS supervisor_name,
                   d.name AS department_name, po.name AS programme_name
            FROM scholars sc
            JOIN supervisors sup ON sc.supervisor_id = sup.id
            LEFT JOIN departments d       ON sc.department_id = d.id
            LEFT JOIN programs_offered po ON sc.programme_id  = po.id
            WHERE 1=1
        `;
        const params = [];
        if (supervisor_id) { sql += ' AND sc.supervisor_id = ?';  params.push(supervisor_id); }
        if (programme_id)  { sql += ' AND sc.programme_id = ?';   params.push(programme_id); }
        if (department_id) { sql += ' AND sc.department_id = ?';  params.push(department_id); }
        if (search && search.trim()) {
            sql += ' AND (sc.scholar_name LIKE ? OR sc.enrollment_no LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        sql += ' ORDER BY sc.created_at DESC';
        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST Scholar
router.post('/scholars', verifyToken, isAdmin, async (req, res) => {
    const { supervisor_id, scholar_name, scholar_type, programme_id, department_id, enrollment_no, admission_date, status } = req.body;
    if (!supervisor_id || !scholar_name) {
        return res.status(400).json({ success: false, message: 'Supervisor and Scholar Name are required' });
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[sup]] = await conn.execute('SELECT current_vacancy FROM supervisors WHERE id = ?', [supervisor_id]);
        if (!sup) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Supervisor not found' }); }

        const targetStatus = status || 'Admitted';
        if (sup.current_vacancy <= 0 && !['Withdrawn','Cancelled','Completed'].includes(targetStatus)) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'No available vacancy under this supervisor' });
        }

        const [result] = await conn.execute(
            `INSERT INTO scholars (supervisor_id, scholar_name, scholar_type, programme_id, department_id, enrollment_no, admission_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [supervisor_id, scholar_name, scholar_type || 'Full-Time', programme_id || null, department_id || null, enrollment_no || null, admission_date || null, targetStatus]
        );
        await syncSupervisorVacancy(conn, supervisor_id);
        await conn.commit();

        await auditLog(req.user.id, req.user.email, 'ADD_SCHOLAR', null,
            { supervisor_id, scholar_name, scholar_type, enrollment_no }, req.ip);

        res.json({ success: true, id: result.insertId, message: 'Scholar added successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally { conn.release(); }
});

// PUT Scholar
router.put('/scholars/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { scholar_name, scholar_type, enrollment_no, admission_date, status, transfer_details } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[existing]] = await conn.execute('SELECT * FROM scholars WHERE id = ?', [id]);
        if (!existing) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Scholar not found' }); }

        await conn.execute(
            `UPDATE scholars SET scholar_name = ?, scholar_type = ?, enrollment_no = ?,
             admission_date = ?, status = ?, transfer_details = ? WHERE id = ?`,
            [
                scholar_name     ?? existing.scholar_name,
                scholar_type     ?? existing.scholar_type,
                enrollment_no    !== undefined ? enrollment_no   : existing.enrollment_no,
                admission_date   !== undefined ? admission_date  : existing.admission_date,
                status           ?? existing.status,
                transfer_details !== undefined ? transfer_details : existing.transfer_details,
                id
            ]
        );
        await syncSupervisorVacancy(conn, existing.supervisor_id);
        await conn.commit();

        await auditLog(req.user.id, req.user.email, 'UPDATE_SCHOLAR', existing,
            { id, scholar_name, scholar_type, status }, req.ip);

        res.json({ success: true, message: 'Scholar updated successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally { conn.release(); }
});

// DELETE Scholar
router.delete('/scholars/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[existing]] = await conn.execute('SELECT * FROM scholars WHERE id = ?', [id]);
        if (!existing) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Scholar not found' }); }

        await conn.execute('DELETE FROM scholars WHERE id = ?', [id]);
        await syncSupervisorVacancy(conn, existing.supervisor_id);
        await conn.commit();

        await auditLog(req.user.id, req.user.email, 'DELETE_SCHOLAR', existing, null, req.ip);
        res.json({ success: true, message: 'Scholar deleted successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally { conn.release(); }
});

module.exports = router;
