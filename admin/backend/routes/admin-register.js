'use strict';
/**
 * Admin Registration Proxy
 *
 * Provides admin-authenticated endpoints that execute the EXACT same
 * registration logic as each portal's self-service signup.
 * No custom forms, no simplified flows, no direct inserts — only the
 * same shared services used by self-registered users.
 */
const { safeError } = require('../../../shared/security/safeError');
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin }    = require('../middleware/auth');
const { hashPassword }            = require('../../../shared/security/passwordHash');
const { validatePasswordComplexity } = require('../../../shared/security/passwordValidator');
const credSvc  = require('../../../shared/credential/credentialNotificationService');
const { logEvent, EVENT_TYPES, SEVERITY } = require('../../../shared/security/auditLogger');
const { generateCETPHDApplicationId }     = require('../../../student/backend/services/applicationIdEngine');

// ── POST /api/admin/register-student ─────────────────────────────────────────
// Same services as student portal POST /api/auth/register:
//   user account creation + application record + Application ID generation.
// Admin bypass: registration_open gate is skipped (admin can always register).
router.post('/register-student', verifyToken, isAdmin, async (req, res) => {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password)
        return res.status(400).json({ success: false, message: 'full_name, email and password are required' });

    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) return res.status(400).json({ success: false, message: pwCheck.message });

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const [[activeSession]] = await conn.execute(
            'SELECT id FROM sessions WHERE is_active = 1 LIMIT 1'
        );
        if (!activeSession) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'No active session. Activate a session before registering applicants.' });
        }
        const sessionId = activeSession.id;

        const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: 'Email is already registered' });
        }

        const hashed = await hashPassword(password);
        const [userResult] = await conn.execute(
            'INSERT INTO users (application_id, full_name, email, password, session_id) VALUES (?, ?, ?, ?, ?)',
            [null, full_name, email, hashed, sessionId]
        );
        const userId = userResult.insertId;

        await conn.execute(
            `INSERT INTO applications
             (application_id, user_id, session_id, status, application_id_generated_at)
             VALUES (?, ?, ?, 'Draft', NULL)`,
            [null, userId, sessionId]
        );

        await conn.commit();

        await logEvent(pool, {
            eventType: EVENT_TYPES.ADMIN_ACTION, portal: 'admin', severity: SEVERITY.MEDIUM,
            userId: req.user?.id, email: req.user?.email, req,
            message: `Admin registered student on behalf: ${email}`,
        }).catch(() => {});

        // Same credential notification email as self-registration
        const loginUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:5173';
        credSvc.notify({ db: pool, name: full_name, email, password, portalType: 'Student', loginUrl }).catch(() => {});

        res.status(201).json({ success: true, message: 'Student registered successfully', applicationId: null, userId });
    } catch (err) {
        await conn.rollback();
        console.error('[AdminRegister] Student error:', err);
        res.status(500).json({ success: false, message: safeError(err) });
    } finally {
        conn.release();
    }
});

// ── POST /api/admin/register-supervisor ──────────────────────────────────────
// Exact same logic as supervisor portal POST /api/auth/signup.
router.post('/register-supervisor', verifyToken, isAdmin, async (req, res) => {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) return res.status(400).json({ success: false, message: pwCheck.message });

    try {
        const [existing] = await pool.query('SELECT id FROM supervisor_users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ success: false, message: 'Email is already registered as a supervisor account' });

        // Auto-link to approved supervisor master record — same as portal signup
        const [supervisorRows] = await pool.query(
            'SELECT id FROM supervisors WHERE email = ? AND status = "Approved" LIMIT 1', [email]
        );
        const supervisorId = supervisorRows.length > 0 ? supervisorRows[0].id : null;

        const hashed = await hashPassword(password);
        const [result] = await pool.query(
            'INSERT INTO supervisor_users (supervisor_id, name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, "active")',
            [supervisorId, name, email, hashed, mobile || null]
        );

        await logEvent(pool, {
            eventType: EVENT_TYPES.ADMIN_ACTION, portal: 'admin', severity: SEVERITY.MEDIUM,
            userId: req.user?.id, email: req.user?.email, req,
            message: `Admin registered supervisor account on behalf: ${email}${supervisorId ? ' (auto-linked to supervisor #' + supervisorId + ')' : ''}`,
        }).catch(() => {});

        // Same credential notification as portal signup
        const loginUrl = process.env.SUPERVISOR_PORTAL_URL || 'http://localhost:5175';
        credSvc.notify({ db: pool, name, email, password, portalType: 'Supervisor', loginUrl }).catch(() => {});

        const { notifyAdmin } = require('../services/notifyAdmin');
        await notifyAdmin(null, {
            event_key:   'supervisor.register',
            title:       `New Supervisor Registered: ${name}`,
            message:     `Email: ${email}${supervisorId ? ` — auto-linked to supervisor #${supervisorId}` : ' — pending manual link'}`,
            type:        'info',
            source_type: 'supervisor',
            source_id:   supervisorId ? String(supervisorId) : String(result.insertId),
            link:        '/supervisors',
        });

        res.status(201).json({
            success: true,
            message: supervisorId
                ? `Supervisor account created and auto-linked to supervisor record #${supervisorId}`
                : 'Supervisor account created. Link the account to a supervisor master record to enable portal access.',
            userId:     result.insertId,
            supervisorId,
            autoLinked: !!supervisorId,
        });
    } catch (err) {
        console.error('[AdminRegister] Supervisor error:', err);
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

// ── POST /api/admin/register-centre ──────────────────────────────────────────
// Exact same logic as centre portal POST /api/auth/signup.
router.post('/register-centre', verifyToken, isAdmin, async (req, res) => {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.valid) return res.status(400).json({ success: false, message: pwCheck.message });

    try {
        const [existing] = await pool.query('SELECT id FROM center_users WHERE email = ?', [email]);
        if (existing.length > 0)
            return res.status(409).json({ success: false, message: 'Email is already registered as a centre account' });

        // Auto-link to approved research centre — same as portal signup
        const [centreRows] = await pool.query(
            'SELECT id FROM research_centres WHERE (email = ? OR hod_email = ?) AND status = "Approved" LIMIT 1',
            [email, email]
        );
        const centerId = centreRows.length > 0 ? centreRows[0].id : null;

        const hashed = await hashPassword(password);
        const [result] = await pool.query(
            'INSERT INTO center_users (center_id, name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, "active")',
            [centerId, name, email, hashed, mobile || null]
        );

        await logEvent(pool, {
            eventType: EVENT_TYPES.ADMIN_ACTION, portal: 'admin', severity: SEVERITY.MEDIUM,
            userId: req.user?.id, email: req.user?.email, req,
            message: `Admin registered centre account on behalf: ${email}${centerId ? ' (auto-linked to centre #' + centerId + ')' : ''}`,
        }).catch(() => {});

        // Same credential notification as portal signup
        const loginUrl = process.env.CENTER_PORTAL_URL || 'http://localhost:5176';
        credSvc.notify({ db: pool, name, email, password, portalType: 'Center', loginUrl }).catch(() => {});

        const { notifyAdmin: notifyAdminCentre } = require('../services/notifyAdmin');
        await notifyAdminCentre(null, {
            event_key:   'center.register',
            title:       `New Exam Centre Registered: ${name}`,
            message:     `Email: ${email}${centerId ? ` — auto-linked to centre #${centerId}` : ' — pending manual link'}`,
            type:        'info',
            source_type: 'center',
            source_id:   centerId ? String(centerId) : String(result.insertId),
            link:        '/centres',
        });

        res.status(201).json({
            success: true,
            message: centerId
                ? `Centre account created and auto-linked to research centre #${centerId}`
                : 'Centre account created. Link the account to a research centre master record to enable portal access.',
            userId:    result.insertId,
            centerId,
            autoLinked: !!centerId,
        });
    } catch (err) {
        console.error('[AdminRegister] Centre error:', err);
        res.status(500).json({ success: false, message: safeError(err) });
    }
});

module.exports = router;
