'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// Multer storage for Excel uploads
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
        if (/openxmlformats-officedocument.spreadsheetml.sheet|vnd.ms-excel/.test(file.mimetype) || file.originalname.endsWith('.xlsx')) {
            return cb(null, true);
        }
        cb(new Error('Only Excel files are allowed'));
    }
});

// Helper for audit logging
async function auditLog(adminId, adminEmail, action, oldValue = null, newValue = null, ip = null) {
    try {
        await pool.execute(
            `INSERT INTO roster_audit_logs (admin_id, admin_email, action, old_value, new_value, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                adminId || null,
                adminEmail || 'system@periyar.edu',
                action,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null,
                ip || null
            ]
        );
    } catch (err) {
        console.error('Failed to write roster audit log:', err.message);
    }
}

// ─── 1. CONFIGURATIONS ────────────────────────────────────────────────────────

// GET Roster Config for a Session
router.get('/config/:session_id', verifyToken, isAdmin, async (req, res) => {
    const { session_id } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM roster_configurations WHERE session_id = ?',
            [session_id]
        );
        if (rows.length === 0) {
            // Seed a default config if not found
            await pool.execute(
                'INSERT INTO roster_configurations (session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage) VALUES (?, 70.00, 70.00, 30.00)',
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

// POST/PUT Roster Config
router.post('/config', verifyToken, isAdmin, async (req, res) => {
    const { session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage } = req.body;
    if (!session_id) return res.status(400).json({ success: false, message: 'session_id is required' });

    try {
        const [existing] = await pool.execute('SELECT * FROM roster_configurations WHERE session_id = ?', [session_id]);
        
        if (existing.length === 0) {
            await pool.execute(
                'INSERT INTO roster_configurations (session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage) VALUES (?, ?, ?, ?)',
                [session_id, pg_eligibility_pct || 70.00, integrated_eligibility_pct || 70.00, merit_percentage || 30.00]
            );
        } else {
            await pool.execute(
                'UPDATE roster_configurations SET pg_eligibility_pct = ?, integrated_eligibility_pct = ?, merit_percentage = ? WHERE session_id = ?',
                [pg_eligibility_pct || 70.00, integrated_eligibility_pct || 70.00, merit_percentage || 30.00, session_id]
            );
        }

        await auditLog(
            req.user.id,
            req.user.email,
            'UPDATE_ROSTER_CONFIG',
            existing[0] || null,
            { session_id, pg_eligibility_pct, integrated_eligibility_pct, merit_percentage },
            req.ip
        );

        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── 2. DYNAMIC SCHOLARS & VACANCIES ──────────────────────────────────────────

// Helper to recalculate supervisor current_scholars_count and current_vacancy
async function syncSupervisorVacancy(connection, supervisorId) {
    // 1. Get capacity
    const [[sup]] = await connection.execute(
        'SELECT max_candidates, max_part_time, max_full_time FROM supervisors WHERE id = ?',
        [supervisorId]
    );
    if (!sup) return;

    // 2. Count active scholars
    const [[{ total_active, pt_active }]] = await connection.execute(
        `SELECT 
            COUNT(*) as total_active,
            SUM(case when scholar_type = 'Part-Time' then 1 else 0 end) as pt_active
         FROM scholars 
         WHERE supervisor_id = ? AND status = 'Admitted'`,
        [supervisorId]
    );

    const scholarsCount   = total_active || 0;
    const ptScholarsCount = pt_active || 0;

    const maxCandidates = sup.max_candidates || 0;
    const maxPt = sup.max_part_time || Math.floor(maxCandidates / 2);

    const newVacancy     = Math.max(0, maxCandidates - scholarsCount);
    const newPtAvailable = Math.max(0, maxPt - ptScholarsCount);
    const newFtAvailable = Math.max(0, maxCandidates - scholarsCount);

    // 3. Update supervisor
    await connection.execute(
        `UPDATE supervisors 
         SET current_scholars_count = ?, current_part_time_scholars_count = ?, current_vacancy = ? 
         WHERE id = ?`,
        [scholarsCount, ptScholarsCount, newVacancy, supervisorId]
    );
}

// GET all scholars
router.get('/scholars', verifyToken, isAdmin, async (req, res) => {
    const { supervisor_id, programme_id, department_id, search } = req.query;
    try {
        let sql = `
            SELECT sc.*, s.name as supervisor_name, d.name as department_name, po.name as programme_name
            FROM scholars sc
            JOIN supervisors s ON sc.supervisor_id = s.id
            LEFT JOIN departments d ON sc.department_id = d.id
            LEFT JOIN programs_offered po ON sc.programme_id = po.id
            WHERE 1=1
        `;
        const params = [];

        if (supervisor_id) { sql += ' AND sc.supervisor_id = ?'; params.push(supervisor_id); }
        if (programme_id) { sql += ' AND sc.programme_id = ?'; params.push(programme_id); }
        if (department_id) { sql += ' AND sc.department_id = ?'; params.push(department_id); }
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

// POST Scholar (Add new)
router.post('/scholars', verifyToken, isAdmin, async (req, res) => {
    const { supervisor_id, scholar_name, scholar_type, programme_id, department_id, enrollment_no, admission_date, status } = req.body;
    if (!supervisor_id || !scholar_name) {
        return res.status(400).json({ success: false, message: 'Supervisor and Scholar Name are required' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Check supervisor capacity
        const [[sup]] = await conn.execute('SELECT current_vacancy, max_candidates FROM supervisors WHERE id = ?', [supervisor_id]);
        if (!sup) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Supervisor not found' });
        }

        if (sup.current_vacancy <= 0 && status !== 'Withdrawn' && status !== 'Cancelled' && status !== 'Completed') {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'No available vacancy under this supervisor' });
        }

        const [result] = await conn.execute(
            `INSERT INTO scholars (supervisor_id, scholar_name, scholar_type, programme_id, department_id, enrollment_no, admission_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [supervisor_id, scholar_name, scholar_type || 'Full-Time', programme_id || null, department_id || null, enrollment_no || null, admission_date || null, status || 'Admitted']
        );

        await syncSupervisorVacancy(conn, supervisor_id);
        await conn.commit();

        await auditLog(
            req.user.id,
            req.user.email,
            'ADD_SCHOLAR',
            null,
            { supervisor_id, scholar_name, scholar_type, enrollment_no },
            req.ip
        );

        res.json({ success: true, id: result.insertId, message: 'Scholar added successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// PUT Scholar (Update scholar / status change)
router.put('/scholars/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { scholar_name, scholar_type, enrollment_no, admission_date, status, transfer_details } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[existing]] = await conn.execute('SELECT * FROM scholars WHERE id = ?', [id]);
        if (!existing) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Scholar record not found' });
        }

        await conn.execute(
            `UPDATE scholars 
             SET scholar_name = ?, scholar_type = ?, enrollment_no = ?, admission_date = ?, status = ?, transfer_details = ?
             WHERE id = ?`,
            [
                scholar_name || existing.scholar_name,
                scholar_type || existing.scholar_type,
                enrollment_no !== undefined ? enrollment_no : existing.enrollment_no,
                admission_date !== undefined ? admission_date : existing.admission_date,
                status || existing.status,
                transfer_details !== undefined ? transfer_details : existing.transfer_details,
                id
            ]
        );

        // Sync vacancies for current supervisor
        await syncSupervisorVacancy(conn, existing.supervisor_id);
        await conn.commit();

        await auditLog(
            req.user.id,
            req.user.email,
            'UPDATE_SCHOLAR',
            existing,
            { id, scholar_name, scholar_type, enrollment_no, status },
            req.ip
        );

        res.json({ success: true, message: 'Scholar updated successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// DELETE Scholar
router.delete('/scholars/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[existing]] = await conn.execute('SELECT * FROM scholars WHERE id = ?', [id]);
        if (!existing) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Scholar not found' });
        }

        await conn.execute('DELETE FROM scholars WHERE id = ?', [id]);
        await syncSupervisorVacancy(conn, existing.supervisor_id);

        await conn.commit();

        await auditLog(
            req.user.id,
            req.user.email,
            'DELETE_SCHOLAR',
            existing,
            null,
            req.ip
        );

        res.json({ success: true, message: 'Scholar deleted successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// ─── 3. REAL-TIME RECALCULATION ENGINE ────────────────────────────────────────

// Execute dynamic rankings, exclusions, merit & community reservation allocations
router.post('/recalculate', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id } = req.body;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch Session Configs
        const [[config]] = await conn.execute(
            'SELECT pg_eligibility_pct, integrated_eligibility_pct, merit_percentage FROM roster_configurations WHERE session_id = ?',
            [session_id]
        );
        const pgThreshold = config ? parseFloat(config.pg_eligibility_pct) : 70.00;
        const intThreshold = config ? parseFloat(config.integrated_eligibility_pct) : 70.00;
        const meritPct = config ? parseFloat(config.merit_percentage) : 30.00;

        // 2. Fetch all active supervisors and calculate vacancies
        const [supervisors] = await conn.execute(
            `SELECT id, max_candidates FROM supervisors 
             WHERE department_id = ? AND status = 'Approved'`,
            [department_id]
        );

        let totalVacancies = 0;
        const supervisorVacancies = {};
        for (const s of supervisors) {
            // Count active scholars for this supervisor
            const [[{ active_count }]] = await conn.execute(
                "SELECT COUNT(*) as active_count FROM scholars WHERE supervisor_id = ? AND status = 'Admitted'",
                [s.id]
            );
            const vacancy = Math.max(0, s.max_candidates - (active_count || 0));
            supervisorVacancies[s.id] = vacancy;
            totalVacancies += vacancy;
        }

        // 3. Fetch Applicants who are approved in this session, program and department
        const [applicants] = await conn.execute(
            `SELECT 
                a.application_id, a.applicant_name, a.subject, a.community, a.entrance_mark,
                a.has_integrated, a.has_pg, a.allotted_supervisor_id
             FROM applications a
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.status = 'Approved'`,
            [session_id, program_id]
        );

        const poolCandidates = [];

        // 4. Score Calculation & Exclusions
        for (const app of applicants) {
            // Get qualification marks
            const [qualRows] = await conn.execute(
                `SELECT score_value, level FROM higher_education 
                 WHERE application_id = ? AND level IN ('PG', 'Integrated')`,
                [app.application_id]
            );

            const pgQual  = qualRows.find(q => q.level === 'PG');
            const intQual = qualRows.find(q => q.level === 'Integrated');

            let degreeType = 'PG';
            let scoreValue = 0;

            if (intQual) {
                degreeType = 'Integrated';
                scoreValue = parseFloat(intQual.score_value) || 0;
            } else if (pgQual) {
                degreeType = 'PG';
                scoreValue = parseFloat(pgQual.score_value) || 0;
            }

            const threshold = degreeType === 'Integrated' ? intThreshold : pgThreshold;
            let isExcluded = 0;
            let exclusionReason = null;

            if (scoreValue < threshold) {
                isExcluded = 1;
                exclusionReason = `Score ${scoreValue}% is below the minimum required ${threshold}% eligibility limit for ${degreeType} degree.`;
            }

            const entranceMark = parseFloat(app.entrance_mark) || 0;
            const academicWeightage = (scoreValue / 100) * 20;
            const finalScore = entranceMark + academicWeightage;

            poolCandidates.push({
                application_id: app.application_id,
                applicant_name: app.applicant_name,
                community: app.community || 'OC',
                score_value: scoreValue,
                entrance_mark: entranceMark,
                academic_weightage: academicWeightage,
                final_score: finalScore,
                degree_type: degreeType,
                is_excluded: isExcluded,
                exclusion_reason: exclusionReason,
                allotted_supervisor_id: app.allotted_supervisor_id || null
            });
        }

        // Separate eligible and excluded candidates
        const eligibleList = poolCandidates.filter(c => c.is_excluded === 0);
        const excludedList = poolCandidates.filter(c => c.is_excluded === 1);

        // Sort eligible by Final Score desc, then entrance, then qual percentage
        eligibleList.sort((a, b) => {
            if (b.final_score !== a.final_score) return b.final_score - a.final_score;
            if (b.entrance_mark !== a.entrance_mark) return b.entrance_mark - a.entrance_mark;
            return b.score_value - a.score_value;
        });

        // 5. MERIT ALLOCATION
        const meritSeatsLimit = Math.round(totalVacancies * meritPct / 100);
        const selectedMerit = [];
        const meritWaiting = [];

        eligibleList.forEach((c, idx) => {
            if (idx < meritSeatsLimit) {
                c.allotted_seat_type = 'Merit';
                c.allotted_category = 'Merit';
                c.selection_status = 'Selected';
                selectedMerit.push(c);
            } else {
                meritWaiting.push(c);
            }
        });

        // 6. COMMUNITY RESERVATION ALLOCATION
        const remainingSeatsCount = Math.max(0, totalVacancies - selectedMerit.length);
        const [communities] = await conn.execute(
            "SELECT community_name, roster_percentage FROM community_fees WHERE status = 'active' ORDER BY sort_order ASC, id ASC"
        );

        const communitySeats = {};
        let allocatedResSeats = 0;

        communities.forEach(c => {
            const seats = Math.round(remainingSeatsCount * (parseFloat(c.roster_percentage) / 100));
            communitySeats[c.community_name] = seats;
        });

        const selectedRes = [];
        const communityWaitlistPool = {};

        // Group remaining waiting candidates by community
        communities.forEach(c => {
            communityWaitlistPool[c.community_name] = meritWaiting.filter(cand => cand.community === c.community_name);
        });

        // Allocate for each community category
        communities.forEach(c => {
            const limit = communitySeats[c.community_name] || 0;
            const pool = communityWaitlistPool[c.community_name] || [];
            
            pool.forEach((cand, idx) => {
                if (idx < limit) {
                    cand.allotted_seat_type = 'Reservation';
                    cand.allotted_category = c.community_name;
                    cand.selection_status = 'Selected';
                    selectedRes.push(cand);
                }
            });
        });

        // All candidates who were selected (Merit + Reservation)
        const selectedIds = new Set([
            ...selectedMerit.map(c => c.application_id),
            ...selectedRes.map(c => c.application_id)
        ]);

        // Remaining candidates go to Waiting List
        const waitingPool = eligibleList.filter(c => !selectedIds.has(c.application_id));
        waitingPool.forEach(c => {
            c.selection_status = 'Waiting';
            c.allotted_seat_type = null;
            c.allotted_category = null;
        });

        // Assign ranks
        // Merit Select Rank
        selectedMerit.forEach((c, idx) => { c.merit_rank = idx + 1; c.reservation_rank = null; });
        // Reservation Select Ranks (within their own community selection)
        const resCounters = {};
        selectedRes.forEach(c => {
            resCounters[c.community] = (resCounters[c.community] || 0) + 1;
            c.reservation_rank = resCounters[c.community];
            c.merit_rank = null;
        });

        // Waiting ranks
        waitingPool.forEach((c, idx) => {
            c.merit_rank = idx + 1;
            // Community waiting rank
            const commWaitList = waitingPool.filter(w => w.community === c.community);
            c.reservation_rank = commWaitList.indexOf(c) + 1;
        });

        // Combine all results
        const finalCalculatedLedger = [
            ...selectedMerit,
            ...selectedRes,
            ...waitingPool,
            ...excludedList.map(c => {
                c.selection_status = 'Not Selected';
                c.allotted_seat_type = null;
                c.allotted_category = null;
                c.merit_rank = null;
                c.reservation_rank = null;
                return c;
            })
        ];

        // 7. Clear old roster allocations for these applicants to prevent duplicate primary keys
        const appIds = poolCandidates.map(c => c.application_id);
        if (appIds.length > 0) {
            const placeholders = appIds.map(() => '?').join(',');
            await conn.execute(
                `DELETE FROM roster_allocations WHERE application_id IN (${placeholders})`,
                appIds
            );

            // 8. Bulk insert the new calculated ledger
            for (const cand of finalCalculatedLedger) {
                await conn.execute(
                    `INSERT INTO roster_allocations (
                        application_id, academic_weightage, final_score, merit_rank, reservation_rank, 
                        selection_status, roster_status, allotted_seat_type, allotted_category, allotted_supervisor_id, 
                        is_excluded, exclusion_reason
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        cand.application_id,
                        cand.academic_weightage,
                        cand.final_score,
                        cand.merit_rank,
                        cand.reservation_rank,
                        cand.selection_status,
                        cand.selection_status === 'Selected' ? 'Selected' : (cand.selection_status === 'Waiting' ? 'Waiting' : 'Selected'),
                        cand.allotted_seat_type,
                        cand.allotted_category,
                        cand.allotted_supervisor_id,
                        cand.is_excluded,
                        cand.exclusion_reason
                    ]
                );
            }
        }

        await conn.commit();

        await auditLog(
            req.user.id,
            req.user.email,
            'ROSTER_RECALCULATED',
            null,
            { session_id, program_id, department_id, totalVacancies, processed_count: poolCandidates.length },
            req.ip
        );

        res.json({ success: true, message: 'Roster calculations and allocations completed successfully' });
    } catch (err) {
        await conn.rollback();
        console.error('Roster recalculation error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// ─── 4. ROSTER SELECTIONS & AUTO-REPLACEMENT APIs ───────────────────────────

// GET Roster Selection Grid List
router.get('/list', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id, supervisor_id, community, status } = req.query;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    try {
        let sql = `
            SELECT 
                a.application_id, a.applicant_name, a.community, a.entrance_mark,
                ra.academic_weightage, ra.final_score, ra.merit_rank, ra.reservation_rank,
                ra.selection_status, ra.roster_status, ra.allotted_seat_type, ra.allotted_category,
                ra.allotted_supervisor_id, ra.is_excluded, ra.exclusion_reason,
                s.name as allotted_supervisor_name,
                po.name as programme_name,
                d.name as department_name,
                he.score_value as degree_percentage,
                he.level as degree_type
            FROM applications a
            LEFT JOIN roster_allocations ra ON a.application_id = ra.application_id
            LEFT JOIN supervisors s ON ra.allotted_supervisor_id = s.id
            LEFT JOIN programs_offered po ON a.program_offered_id = po.id
            LEFT JOIN departments d ON a.department_id = d.id
            LEFT JOIN higher_education he ON (a.application_id = he.application_id AND he.level IN ('PG', 'Integrated'))
            WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
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

        sql += ' ORDER BY ra.is_excluded ASC, ra.final_score DESC, ra.merit_rank ASC';

        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT Update Selection Status / Trigger Auto Replacement
router.put('/status/:application_id', verifyToken, isAdmin, async (req, res) => {
    const { application_id } = req.params;
    const { roster_status } = req.body; // e.g. Rejected, Withdrawn, No Show, Joined, etc.

    const releasedStates = ['Rejected', 'No Show', 'Verification Failed', 'Withdrawn', 'Cancelled'];
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Get current allocation details
        const [[alloc]] = await conn.execute(
            `SELECT ra.*, a.session_id, a.program_offered_id, a.department_id, a.community
             FROM roster_allocations ra
             JOIN applications a ON ra.application_id = a.application_id
             WHERE ra.application_id = ?`,
            [application_id]
        );

        if (!alloc) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Allocation details not found' });
        }

        const oldStatus = alloc.roster_status;
        const wasSelected = alloc.selection_status === 'Selected';

        // Update roster status
        await conn.execute(
            'UPDATE roster_allocations SET roster_status = ?, updated_at = NOW() WHERE application_id = ?',
            [roster_status, application_id]
        );

        const replacementDetails = [];

        // 2. If it was Selected and is now changed to a released state, trigger Auto-Replacement!
        if (wasSelected && releasedStates.includes(roster_status)) {
            // Update this candidate to not selected/released
            await conn.execute(
                "UPDATE roster_allocations SET selection_status = 'Not Selected', merit_rank = NULL, reservation_rank = NULL WHERE application_id = ?",
                [application_id]
            );

            // Determine quota type and category
            const seatType = alloc.allotted_seat_type; // 'Merit' or 'Reservation'
            const category = alloc.allotted_category; // 'Merit' or community name (e.g. 'BC')

            // Fetch the next waiting candidate in this exact quota category and program/department
            let nextCandidateQuery = `
                SELECT ra.application_id, a.applicant_name, a.community
                FROM roster_allocations ra
                JOIN applications a ON ra.application_id = a.application_id
                WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
                  AND ra.selection_status = 'Waiting' AND ra.is_excluded = 0
            `;
            const queryParams = [alloc.session_id, alloc.program_offered_id, alloc.department_id];

            if (seatType === 'Reservation') {
                nextCandidateQuery += ' AND a.community = ?';
                queryParams.push(alloc.community);
            }

            nextCandidateQuery += ' ORDER BY ra.final_score DESC, ra.created_at ASC LIMIT 1';

            const [[nextCand]] = await conn.execute(nextCandidateQuery, queryParams);

            if (nextCand) {
                // Promote this candidate!
                await conn.execute(
                    `UPDATE roster_allocations 
                     SET selection_status = 'Selected', roster_status = 'Selected',
                         allotted_seat_type = ?, allotted_category = ?, updated_at = NOW() 
                     WHERE application_id = ?`,
                    [seatType, category, nextCand.application_id]
                );

                replacementDetails.push({
                    released_applicant_id: application_id,
                    released_name: alloc.applicant_name,
                    promoted_applicant_id: nextCand.application_id,
                    promoted_name: nextCand.applicant_name,
                    seat_type: seatType,
                    category: category
                });

                // Audit promotion
                await auditLog(
                    req.user.id,
                    req.user.email,
                    'AUTO_PROMOTION',
                    { released_application_id: application_id, quota: category },
                    { promoted_application_id: nextCand.application_id, promoted_name: nextCand.applicant_name },
                    req.ip
                );
            }
        }

        await conn.commit();

        await auditLog(
            req.user.id,
            req.user.email,
            'UPDATE_ROSTER_STATUS',
            { application_id, roster_status: oldStatus },
            { application_id, roster_status, promotions: replacementDetails },
            req.ip
        );

        res.json({
            success: true,
            message: 'Status updated successfully',
            promoted: replacementDetails.length > 0 ? replacementDetails[0] : null
        });
    } catch (err) {
        await conn.rollback();
        console.error('Auto promotion status error:', err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// Update supervisor allocation for a selected candidate
router.put('/allocate-supervisor/:application_id', verifyToken, isAdmin, async (req, res) => {
    const { application_id } = req.params;
    const { supervisor_id } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[alloc]] = await conn.execute('SELECT * FROM roster_allocations WHERE application_id = ?', [application_id]);
        if (!alloc) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Roster record not found' });
        }

        // If assigning, check capacity
        if (supervisor_id) {
            const [[sup]] = await conn.execute('SELECT current_vacancy, name FROM supervisors WHERE id = ?', [supervisor_id]);
            if (!sup) {
                await conn.rollback();
                return res.status(404).json({ success: false, message: 'Supervisor not found' });
            }
            if (sup.current_vacancy <= 0 && alloc.allotted_supervisor_id !== parseInt(supervisor_id)) {
                await conn.rollback();
                return res.status(400).json({ success: false, message: `Supervisor ${sup.name} has no vacancy available` });
            }
        }

        // Update roster allocation
        await conn.execute(
            'UPDATE roster_allocations SET allotted_supervisor_id = ?, updated_at = NOW() WHERE application_id = ?',
            [supervisor_id || null, application_id]
        );

        // Update application allotted_supervisor_id to keep backward compatibility
        await conn.execute(
            'UPDATE applications SET allotted_supervisor_id = ?, updated_at = NOW() WHERE application_id = ?',
            [supervisor_id || null, application_id]
        );

        await conn.commit();

        await auditLog(
            req.user.id,
            req.user.email,
            'ALLOCATE_SUPERVISOR',
            { application_id, supervisor_id: alloc.allotted_supervisor_id },
            { application_id, supervisor_id },
            req.ip
        );

        res.json({ success: true, message: 'Supervisor allocated successfully' });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ success: false, message: err.message });
    } finally {
        conn.release();
    }
});

// ─── 5. EXCEL SYNC ENGINE ────────────────────────────────────────────────────

// GET Export Roster
router.get('/export', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id, supervisor_id, community } = req.query;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    try {
        let sql = `
            SELECT 
                a.application_id, a.applicant_name, a.community, a.entrance_mark,
                ra.academic_weightage, ra.final_score, ra.merit_rank, ra.reservation_rank,
                ra.selection_status, ra.roster_status, ra.allotted_seat_type, ra.allotted_category,
                s.name as allotted_supervisor_name,
                po.name as programme_name,
                d.name as department_name,
                he.score_value as degree_percentage,
                he.level as degree_type
            FROM applications a
            LEFT JOIN roster_allocations ra ON a.application_id = ra.application_id
            LEFT JOIN supervisors s ON ra.allotted_supervisor_id = s.id
            LEFT JOIN programs_offered po ON a.program_offered_id = po.id
            LEFT JOIN departments d ON a.department_id = d.id
            LEFT JOIN higher_education he ON (a.application_id = he.application_id AND he.level IN ('PG', 'Integrated'))
            WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?
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

        sql += ' ORDER BY ra.is_excluded ASC, ra.final_score DESC, ra.merit_rank ASC';

        const [rows] = await pool.execute(sql, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Roster Selections');

        // Header info blocks
        sheet.addRow([]);
        const titleRow = sheet.addRow(['PERIYAR UNIVERSITY - Ph.D ERP ROSTER SELECT ENGINE']);
        titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
        
        const detailsStr = rows.length > 0 
            ? `Programme: ${rows[0].programme_name} | Department: ${rows[0].department_name}`
            : 'Ph.D Roster Management';
        const metaRow = sheet.addRow([detailsStr]);
        metaRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF555555' } };
        sheet.addRow([]);

        const headers = [
            'Applicant ID', 'Applicant Name', 'Degree Category', 'Degree %', 'Academic Wt.',
            'Entrance Mark', 'Final Score', 'Merit Rank', 'Reservation Rank', 
            'Selection Status', 'Roster Status', 'Quota Category', 'Allotted Supervisor'
        ];

        const headerRow = sheet.addRow(headers);
        headerRow.height = 24;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // Rows
        rows.forEach((r, idx) => {
            const dataRow = [
                r.application_id,
                r.applicant_name,
                r.degree_type || 'PG',
                r.degree_percentage ? parseFloat(r.degree_percentage) : 0,
                r.academic_weightage ? parseFloat(r.academic_weightage) : 0,
                r.entrance_mark ? parseFloat(r.entrance_mark) : 0,
                r.final_score ? parseFloat(r.final_score) : 0,
                r.merit_rank || '—',
                r.reservation_rank || '—',
                r.selection_status || 'Not Selected',
                r.roster_status || 'Waiting',
                r.allotted_category || '—',
                r.allotted_supervisor_name || '—'
            ];
            const addedRow = sheet.addRow(dataRow);
            addedRow.height = 20;

            const isEven = idx % 2 === 0;
            addedRow.eachCell(cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.font = { size: 10 };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                };
                if (isEven) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
                }
            });
        });

        // Autofit columns width
        sheet.columns.forEach(column => {
            let maxLen = 12;
            column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 4) {
                    const len = cell.value ? String(cell.value).length : 0;
                    if (len > maxLen) maxLen = len;
                }
            });
            column.width = Math.min(maxLen + 4, 35);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="roster_export_${Date.now()}.xlsx"`);
        const buffer = await workbook.xlsx.writeBuffer();
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Export failed: ' + err.message });
    }
});

// POST Import Roster Excel
router.post('/import', verifyToken, isAdmin, uploadExcel.single('excel'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No excel file uploaded' });
    const { session_id, program_id, department_id } = req.body;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required fields' });
    }

    const filePath = req.file.path;
    const conn = await pool.getConnection();

    let total = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    const updatesPerformed = [];

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const sheet = workbook.getWorksheet(1);
        if (!sheet) throw new Error('Sheet not found in workbook');

        await conn.beginTransaction();

        // Roster headers mapping
        // Columns index:
        // 1: Applicant ID, 2: Applicant Name, 3: Degree Category, 4: Degree %, 5: Academic Wt., 
        // 6: Entrance Mark, 7: Final Score, 8: Merit Rank, 9: Reservation Rank, 
        // 10: Selection Status, 11: Roster Status, 12: Quota Category, 13: Allotted Supervisor

        const rowCount = sheet.rowCount;
        for (let i = 5; i <= rowCount; i++) { // Header ends at row 4
            const row = sheet.getRow(i);
            const appId = row.getCell(1).value ? String(row.getCell(1).value).trim() : null;
            if (!appId || appId === 'Applicant ID') continue;

            total++;

            const degreePctVal = row.getCell(4).value;
            const entranceMarkVal = row.getCell(6).value;
            const rosterStatusVal = row.getCell(11).value ? String(row.getCell(11).value).trim() : null;
            const supervisorNameVal = row.getCell(13).value ? String(row.getCell(13).value).trim() : null;

            try {
                // Verify candidate exists in this scope
                const [[app]] = await conn.execute(
                    'SELECT application_id, has_integrated FROM applications WHERE application_id = ? AND session_id = ? AND program_offered_id = ?',
                    [appId, session_id, program_id]
                );

                if (!app) {
                    failed++;
                    errors.push({ row: i, id: appId, error: `Applicant ID not found in this filtered programme scope.` });
                    continue;
                }

                let isDirty = false;
                const changes = {};

                // 1. Validate and Update Entrance Marks
                if (entranceMarkVal !== null && entranceMarkVal !== undefined && entranceMarkVal !== '') {
                    const entranceMark = parseFloat(entranceMarkVal);
                    if (isNaN(entranceMark) || entranceMark < 0 || entranceMark > 70) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Entrance mark ${entranceMarkVal} is invalid (must be 0-70).` });
                        continue;
                    }
                    // Fetch existing
                    const [[existingApp]] = await conn.execute('SELECT entrance_mark FROM applications WHERE application_id = ?', [appId]);
                    if (existingApp && parseFloat(existingApp.entrance_mark) !== entranceMark) {
                        await conn.execute('UPDATE applications SET entrance_mark = ?, updated_at = NOW() WHERE application_id = ?', [entranceMark, appId]);
                        isDirty = true;
                        changes.entrance_mark = { old: existingApp.entrance_mark, new: entranceMark };
                    }
                }

                // 2. Validate and Update Degree Marks
                if (degreePctVal !== null && degreePctVal !== undefined && degreePctVal !== '') {
                    const degreePct = parseFloat(degreePctVal);
                    if (isNaN(degreePct) || degreePct < 0 || degreePct > 100) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Degree percentage ${degreePctVal} is invalid (must be 0-100).` });
                        continue;
                    }

                    const degreeLevel = app.has_integrated ? 'Integrated' : 'PG';
                    const [[existingQual]] = await conn.execute(
                        'SELECT score_value FROM higher_education WHERE application_id = ? AND level = ?',
                        [appId, degreeLevel]
                    );

                    if (existingQual && parseFloat(existingQual.score_value) !== degreePct) {
                        await conn.execute(
                            'UPDATE higher_education SET score_value = ?, score_type = "Percentage" WHERE application_id = ? AND level = ?',
                            [degreePct, appId, degreeLevel]
                        );
                        isDirty = true;
                        changes.degree_percentage = { old: existingQual.score_value, new: degreePct };
                    }
                }

                // 3. Validate and Update Supervisor Allocation
                if (supervisorNameVal && supervisorNameVal !== '—') {
                    // Try to find supervisor by name
                    const [[sup]] = await conn.execute(
                        'SELECT id, name, current_vacancy FROM supervisors WHERE name = ? AND department_id = ?',
                        [supervisorNameVal, department_id]
                    );

                    if (!sup) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Supervisor "${supervisorNameVal}" not found in this department.` });
                        continue;
                    }

                    const [[existingAlloc]] = await conn.execute('SELECT allotted_supervisor_id FROM roster_allocations WHERE application_id = ?', [appId]);
                    if (!existingAlloc || existingAlloc.allotted_supervisor_id !== sup.id) {
                        if (sup.current_vacancy <= 0) {
                            failed++;
                            errors.push({ row: i, id: appId, error: `Supervisor "${supervisorNameVal}" has no vacancy available.` });
                            continue;
                        }
                        // Update allotted supervisor
                        await conn.execute('UPDATE roster_allocations SET allotted_supervisor_id = ? WHERE application_id = ?', [sup.id, appId]);
                        await conn.execute('UPDATE applications SET allotted_supervisor_id = ? WHERE application_id = ?', [sup.id, appId]);
                        isDirty = true;
                        changes.supervisor = { old: existingAlloc ? existingAlloc.allotted_supervisor_id : null, new: sup.id };
                    }
                }

                // 4. Update Roster Status
                if (rosterStatusVal) {
                    const validStatuses = ['Selected', 'Waiting', 'Joined', 'Rejected', 'No Show', 'Verification Failed', 'Withdrawn', 'Cancelled'];
                    if (!validStatuses.includes(rosterStatusVal)) {
                        failed++;
                        errors.push({ row: i, id: appId, error: `Roster status "${rosterStatusVal}" is invalid.` });
                        continue;
                    }

                    const [[existingAlloc]] = await conn.execute('SELECT roster_status FROM roster_allocations WHERE application_id = ?', [appId]);
                    if (existingAlloc && existingAlloc.roster_status !== rosterStatusVal) {
                        // Update status
                        await conn.execute('UPDATE roster_allocations SET roster_status = ? WHERE application_id = ?', [rosterStatusVal, appId]);
                        isDirty = true;
                        changes.roster_status = { old: existingAlloc.roster_status, new: rosterStatusVal };
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

        // 5. Trigger dynamic Recalculation so that ranks and exclusions are completely sync'd!
        if (updated > 0) {
            // Mock token/req details inside endpoint to trigger recalculation function safely
            const recalculateResponse = await fetch(`http://localhost:${process.env.ADMIN_BACKEND_PORT || 5001}/api/roster/recalculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': req.headers.authorization
                },
                body: JSON.stringify({ session_id, program_id, department_id })
            });
            const recJson = await recalculateResponse.json();
            if (!recJson.success) {
                throw new Error('Import updates succeeded but Recalculation Engine failed: ' + recJson.message);
            }
        }

        await auditLog(
            req.user.id,
            req.user.email,
            'IMPORT_ROSTER_EXCEL',
            null,
            { total, updated, skipped, failed, updatesPerformed, errors },
            req.ip
        );

        // Delete temporary file
        try { fs.unlinkSync(filePath); } catch (_) {}

        res.json({
            success: true,
            total,
            updated,
            skipped,
            failed,
            errors
        });
    } catch (err) {
        await conn.rollback();
        try { fs.unlinkSync(filePath); } catch (_) {}
        console.error('Roster import failure:', err);
        res.status(500).json({ success: false, message: 'Roster Excel import failed: ' + err.message });
    } finally {
        conn.release();
    }
});

// ─── 6. DASHBOARD ANALYTICS ──────────────────────────────────────────────────

// GET dynamic aggregate stats for roster dashboard
router.get('/analytics', verifyToken, isAdmin, async (req, res) => {
    const { session_id, program_id, department_id } = req.query;
    if (!session_id || !program_id || !department_id) {
        return res.status(400).json({ success: false, message: 'session_id, program_id, and department_id are required' });
    }

    try {
        // Total Applicants
        const [[{ total_applicants }]] = await pool.execute(
            `SELECT COUNT(*) as total_applicants 
             FROM applications 
             WHERE session_id = ? AND program_offered_id = ? AND department_id = ? AND status = 'Approved'`,
            [session_id, program_id, department_id]
        );

        // Eligible / Ineligible
        const [[{ eligible, ineligible }]] = await pool.execute(
            `SELECT 
                SUM(case when ra.is_excluded = 0 then 1 else 0 end) as eligible,
                SUM(case when ra.is_excluded = 1 then 1 else 0 end) as ineligible
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?`,
            [session_id, program_id, department_id]
        );

        // Selected / Waiting
        const [[{ selected, waiting }]] = await pool.execute(
            `SELECT 
                SUM(case when ra.selection_status = 'Selected' then 1 else 0 end) as selected,
                SUM(case when ra.selection_status = 'Waiting' then 1 else 0 end) as waiting
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ?`,
            [session_id, program_id, department_id]
        );

        // Merit seats / Reservation seats
        const [[{ merit_seats, reservation_seats }]] = await pool.execute(
            `SELECT 
                SUM(case when ra.allotted_seat_type = 'Merit' then 1 else 0 end) as merit_seats,
                SUM(case when ra.allotted_seat_type = 'Reservation' then 1 else 0 end) as reservation_seats
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ? AND ra.selection_status = 'Selected'`,
            [session_id, program_id, department_id]
        );

        // Total Vacancies
        const [supervisors] = await pool.execute(
            'SELECT id, max_candidates FROM supervisors WHERE department_id = ? AND status = "Approved"',
            [department_id]
        );
        let totalVacancies = 0;
        for (const s of supervisors) {
            const [[{ active_count }]] = await pool.execute(
                "SELECT COUNT(*) as active_count FROM scholars WHERE supervisor_id = ? AND status = 'Admitted'",
                [s.id]
            );
            totalVacancies += Math.max(0, s.max_candidates - (active_count || 0));
        }

        // Community-wise selected distribution
        const [commDist] = await pool.execute(
            `SELECT a.community, COUNT(*) as count
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ? AND ra.selection_status = 'Selected'
             GROUP BY a.community`,
            [session_id, program_id, department_id]
        );

        // Supervisor-wise selected distribution
        const [supDist] = await pool.execute(
            `SELECT s.name as supervisor_name, COUNT(*) as count
             FROM applications a
             JOIN roster_allocations ra ON a.application_id = ra.application_id
             JOIN supervisors s ON ra.allotted_supervisor_id = s.id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.department_id = ? AND ra.selection_status = 'Selected'
             GROUP BY s.id, s.name`,
            [session_id, program_id, department_id]
        );

        // Department-wise distribution (For the dashboard)
        const [deptDist] = await pool.execute(
            `SELECT d.name as department_name, COUNT(*) as count
             FROM applications a
             JOIN departments d ON a.department_id = d.id
             WHERE a.session_id = ? AND a.program_offered_id = ? AND a.status = 'Approved'
             GROUP BY d.id, d.name`,
            [session_id, program_id]
        );

        res.json({
            success: true,
            data: {
                totalApplicants: total_applicants || 0,
                eligibleApplicants: eligible || 0,
                ineligibleApplicants: ineligible || 0,
                totalVacancies: totalVacancies || 0,
                meritSeats: merit_seats || 0,
                reservationSeats: reservation_seats || 0,
                selectedCandidates: selected || 0,
                waitingCandidates: waiting || 0,
                communityDistribution: commDist,
                supervisorDistribution: supDist,
                departmentDistribution: deptDist
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── 7. AUDIT LOGS ───────────────────────────────────────────────────────────

// GET searchable and exportable audit logs
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    const { search, start_date, end_date } = req.query;
    try {
        let sql = 'SELECT * FROM roster_audit_logs WHERE 1=1';
        const params = [];

        if (start_date) {
            sql += ' AND created_at >= ?';
            params.push(start_date + ' 00:00:00');
        }
        if (end_date) {
            sql += ' AND created_at <= ?';
            params.push(end_date + ' 23:59:59');
        }
        if (search && search.trim()) {
            sql += ' AND (admin_email LIKE ? OR action LIKE ? OR old_value LIKE ? OR new_value LIKE ?)';
            const likeStr = `%${search.trim()}%`;
            params.push(likeStr, likeStr, likeStr, likeStr);
        }

        sql += ' ORDER BY created_at DESC LIMIT 500';

        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
