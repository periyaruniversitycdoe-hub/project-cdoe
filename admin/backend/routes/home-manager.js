'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ── Self-healing table init ───────────────────────────────────────────────────
async function ensureTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS home_action_buttons (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            btn_type ENUM('apply_now','applicant_login','download_prospectus','instruction','custom') NOT NULL DEFAULT 'custom',
            url VARCHAR(500) DEFAULT NULL,
            icon VARCHAR(50) DEFAULT NULL,
            bg_color VARCHAR(20) DEFAULT '#009688',
            text_color VARCHAR(20) DEFAULT '#ffffff',
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        INSERT IGNORE INTO home_action_buttons (id, name, btn_type, icon, bg_color, text_color, sort_order, is_active) VALUES
            (1,'Download Prospectus','download_prospectus','Download','#009688','#ffffff',1,1),
            (2,'Instruction','instruction','Info','#FF8F00','#ffffff',2,1),
            (3,'Apply Now','apply_now','GraduationCap','#6A1B9A','#ffffff',3,1),
            (4,'Applicant Login','applicant_login','LogIn','#2E7D32','#ffffff',4,1)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS home_quick_links (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            url VARCHAR(500) DEFAULT NULL,
            link_type ENUM('internal','external') NOT NULL DEFAULT 'internal',
            icon VARCHAR(50) DEFAULT NULL,
            color VARCHAR(20) DEFAULT '#6A1B9A',
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        INSERT IGNORE INTO home_quick_links (id, name, url, link_type, color, sort_order, is_active) VALUES
            (1,'Apply Now (New Application)','/register','internal','#6A1B9A',1,1),
            (2,'Existing Applicant Login','/login','internal','#2E7D32',2,1),
            (3,'Forgot Password','/forgot-password','internal','#E65100',3,1)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS home_contacts (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            contact_type ENUM('email','mobile','landline','whatsapp','website','address') NOT NULL DEFAULT 'email',
            label VARCHAR(100) DEFAULT NULL,
            value VARCHAR(500) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        INSERT IGNORE INTO home_contacts (id, contact_type, label, value, sort_order, is_active) VALUES
            (1,'email','Email','admissions@periyaruniversity.ac.in',1,1),
            (2,'landline','Phone','0427-2345766',2,1),
            (3,'address','Address','Salem – 636 011, Tamil Nadu, India',3,1)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS home_layout (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            block_key VARCHAR(50) NOT NULL UNIQUE,
            block_label VARCHAR(100) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
        INSERT IGNORE INTO home_layout (block_key, block_label, sort_order, is_active) VALUES
            ('admission_notifications','Admission Notifications',1,1),
            ('guidelines','Guidelines & Declarations',2,1),
            ('important_dates','Important Dates',3,1),
            ('quick_links','Quick Links',4,1),
            ('contact','Contact Us',5,1)
    `);
    await pool.query(`
        UPDATE home_layout 
        SET block_label = 'Guidelines & Declarations'
        WHERE block_key = 'guidelines'
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS home_audit_logs (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            action ENUM('create','update','delete','toggle','reorder') NOT NULL,
            section VARCHAR(50) NOT NULL,
            entity_id INT DEFAULT NULL,
            old_value TEXT DEFAULT NULL,
            new_value TEXT DEFAULT NULL,
            performed_by VARCHAR(100) DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

ensureTables().catch(err => console.error('home_manager table init error:', err.message));

// ── Audit helper ─────────────────────────────────────────────────────────────
async function audit(action, section, entityId, oldVal, newVal, req) {
    try {
        const who = req.user?.email || req.user?.username || 'admin';
        const ip  = req.ip || req.headers['x-forwarded-for'] || null;
        await pool.query(
            `INSERT INTO home_audit_logs (action,section,entity_id,old_value,new_value,performed_by,ip_address)
             VALUES (?,?,?,?,?,?,?)`,
            [action, section, entityId || null,
             oldVal ? JSON.stringify(oldVal) : null,
             newVal ? JSON.stringify(newVal) : null,
             who, ip]
        );
    } catch (_) { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC — consolidated homepage endpoint (used by student portal)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/homepage', async (_req, res) => {
    try {
        await ensureTables();
        const [[btns],  [links], [contacts], [layout]] = await Promise.all([
            pool.query(`SELECT * FROM home_action_buttons WHERE is_active=1 ORDER BY sort_order ASC`),
            pool.query(`SELECT * FROM home_quick_links   WHERE is_active=1 ORDER BY sort_order ASC`),
            pool.query(`SELECT * FROM home_contacts      WHERE is_active=1 ORDER BY sort_order ASC`),
            pool.query(`SELECT * FROM home_layout                         ORDER BY sort_order ASC`),
        ]);
        res.json({ success: true, data: { action_buttons: btns, quick_links: links, contacts, layout } });
    } catch (err) {
        res.json({ success: true, data: { action_buttons: [], quick_links: [], contacts: [], layout: [] } });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ACTION BUTTONS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/action-buttons', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM home_action_buttons ORDER BY sort_order ASC`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/action-buttons', verifyToken, isAdmin, async (req, res) => {
    const { name, btn_type = 'custom', url, icon, bg_color = '#009688', text_color = '#ffffff', sort_order = 0, is_active = 1 } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    try {
        const [r] = await pool.query(
            `INSERT INTO home_action_buttons (name,btn_type,url,icon,bg_color,text_color,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?)`,
            [name.trim(), btn_type, url || null, icon || null, bg_color, text_color, sort_order, is_active ? 1 : 0]
        );
        await audit('create', 'action_buttons', r.insertId, null, req.body, req);
        res.json({ success: true, data: { id: r.insertId } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/action-buttons/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array required' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const { id, sort_order } of orders) {
            await conn.query(`UPDATE home_action_buttons SET sort_order=? WHERE id=?`, [sort_order, id]);
        }
        await conn.commit();
        await audit('reorder', 'action_buttons', null, null, orders, req);
        res.json({ success: true });
    } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
    finally { conn.release(); }
});

router.put('/action-buttons/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, btn_type, url, icon, bg_color, text_color, sort_order, is_active } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    try {
        const [[old]] = await pool.query(`SELECT * FROM home_action_buttons WHERE id=?`, [id]);
        await pool.query(
            `UPDATE home_action_buttons SET name=?,btn_type=?,url=?,icon=?,bg_color=?,text_color=?,sort_order=?,is_active=? WHERE id=?`,
            [name.trim(), btn_type || 'custom', url || null, icon || null, bg_color || '#009688', text_color || '#ffffff', sort_order ?? 0, is_active ? 1 : 0, id]
        );
        await audit('update', 'action_buttons', Number(id), old, req.body, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/action-buttons/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [[old]] = await pool.query(`SELECT * FROM home_action_buttons WHERE id=?`, [id]);
        await pool.query(`DELETE FROM home_action_buttons WHERE id=?`, [id]);
        await audit('delete', 'action_buttons', Number(id), old, null, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/action-buttons/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE home_action_buttons SET is_active = 1 - is_active WHERE id=?`, [id]);
        await audit('toggle', 'action_buttons', Number(id), null, null, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  QUICK LINKS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/quick-links', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM home_quick_links ORDER BY sort_order ASC`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/quick-links', verifyToken, isAdmin, async (req, res) => {
    const { name, url, link_type = 'internal', icon, color = '#6A1B9A', sort_order = 0, is_active = 1 } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    try {
        const [r] = await pool.query(
            `INSERT INTO home_quick_links (name,url,link_type,icon,color,sort_order,is_active) VALUES (?,?,?,?,?,?,?)`,
            [name.trim(), url || null, link_type, icon || null, color, sort_order, is_active ? 1 : 0]
        );
        await audit('create', 'quick_links', r.insertId, null, req.body, req);
        res.json({ success: true, data: { id: r.insertId } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/quick-links/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array required' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const { id, sort_order } of orders) {
            await conn.query(`UPDATE home_quick_links SET sort_order=? WHERE id=?`, [sort_order, id]);
        }
        await conn.commit();
        await audit('reorder', 'quick_links', null, null, orders, req);
        res.json({ success: true });
    } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
    finally { conn.release(); }
});

router.put('/quick-links/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, url, link_type, icon, color, sort_order, is_active } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    try {
        const [[old]] = await pool.query(`SELECT * FROM home_quick_links WHERE id=?`, [id]);
        await pool.query(
            `UPDATE home_quick_links SET name=?,url=?,link_type=?,icon=?,color=?,sort_order=?,is_active=? WHERE id=?`,
            [name.trim(), url || null, link_type || 'internal', icon || null, color || '#6A1B9A', sort_order ?? 0, is_active ? 1 : 0, id]
        );
        await audit('update', 'quick_links', Number(id), old, req.body, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/quick-links/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [[old]] = await pool.query(`SELECT * FROM home_quick_links WHERE id=?`, [id]);
        await pool.query(`DELETE FROM home_quick_links WHERE id=?`, [id]);
        await audit('delete', 'quick_links', Number(id), old, null, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/quick-links/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE home_quick_links SET is_active = 1 - is_active WHERE id=?`, [id]);
        await audit('toggle', 'quick_links', Number(id), null, null, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  CONTACTS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/contacts', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM home_contacts ORDER BY sort_order ASC`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/contacts', verifyToken, isAdmin, async (req, res) => {
    const { contact_type = 'email', label, value, sort_order = 0, is_active = 1 } = req.body;
    if (!value?.trim()) return res.status(400).json({ success: false, message: 'Value is required' });
    try {
        const [r] = await pool.query(
            `INSERT INTO home_contacts (contact_type,label,value,sort_order,is_active) VALUES (?,?,?,?,?)`,
            [contact_type, label?.trim() || null, value.trim(), sort_order, is_active ? 1 : 0]
        );
        await audit('create', 'contacts', r.insertId, null, req.body, req);
        res.json({ success: true, data: { id: r.insertId } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/contacts/reorder', verifyToken, isAdmin, async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ success: false, message: 'orders array required' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const { id, sort_order } of orders) {
            await conn.query(`UPDATE home_contacts SET sort_order=? WHERE id=?`, [sort_order, id]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
    finally { conn.release(); }
});

router.put('/contacts/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { contact_type, label, value, sort_order, is_active } = req.body;
    if (!value?.trim()) return res.status(400).json({ success: false, message: 'Value is required' });
    try {
        const [[old]] = await pool.query(`SELECT * FROM home_contacts WHERE id=?`, [id]);
        await pool.query(
            `UPDATE home_contacts SET contact_type=?,label=?,value=?,sort_order=?,is_active=? WHERE id=?`,
            [contact_type || 'email', label?.trim() || null, value.trim(), sort_order ?? 0, is_active ? 1 : 0, id]
        );
        await audit('update', 'contacts', Number(id), old, req.body, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/contacts/:id', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const [[old]] = await pool.query(`SELECT * FROM home_contacts WHERE id=?`, [id]);
        await pool.query(`DELETE FROM home_contacts WHERE id=?`, [id]);
        await audit('delete', 'contacts', Number(id), old, null, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/contacts/:id/toggle', verifyToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE home_contacts SET is_active = 1 - is_active WHERE id=?`, [id]);
        await audit('toggle', 'contacts', Number(id), null, null, req);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  LAYOUT MANAGER
// ═══════════════════════════════════════════════════════════════════════════
router.get('/layout', verifyToken, isAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM home_layout ORDER BY sort_order ASC`);
        res.json({ success: true, data: rows });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/layout', verifyToken, isAdmin, async (req, res) => {
    const { blocks } = req.body;
    if (!Array.isArray(blocks)) return res.status(400).json({ success: false, message: 'blocks array required' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (const { block_key, sort_order, is_active } of blocks) {
            await conn.query(
                `UPDATE home_layout SET sort_order=?, is_active=? WHERE block_key=?`,
                [sort_order, is_active ? 1 : 0, block_key]
            );
        }
        await conn.commit();
        await audit('reorder', 'layout', null, null, blocks, req);
        res.json({ success: true });
    } catch (err) { await conn.rollback(); res.status(500).json({ success: false, message: err.message }); }
    finally { conn.release(); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
    const offset = parseInt(req.query.offset) || 0;
    const section = req.query.section || null;
    try {
        const where = section ? `WHERE section=?` : '';
        const params = section ? [section, limit, offset] : [limit, offset];
        const [rows] = await pool.query(
            `SELECT * FROM home_audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            params
        );
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM home_audit_logs ${where}`,
            section ? [section] : []
        );
        res.json({ success: true, data: rows, total });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
