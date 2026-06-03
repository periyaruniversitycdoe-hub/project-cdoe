'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const path    = require('path');

/**
 * Factory — returns an Express router for user-facing chatbot APIs.
 * Mount this on each portal backend:
 *   app.use('/api/chatbot', chatbotPublicRoutes({ portalKey: 'student', jwtSecret: process.env.STUDENT_JWT_SECRET, db }));
 */
module.exports = function createChatbotPublicRoutes({ portalKey = 'public', jwtSecret = null, db }) {
    if (!db) throw new Error('chatbotPublicRoutes: db pool is required');

    const router = express.Router();

    function generateQueryRef() {
        const n = new Date();
        const r = Math.random().toString(36).substr(2, 5).toUpperCase();
        return `Q-${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}-${r}`;
    }

    // Optional auth middleware — attaches req.user if valid token present, never blocks
    function optAuth(req, _res, next) {
        const raw = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
        req.user = null;
        if (raw && jwtSecret) {
            try { req.user = jwt.verify(raw, jwtSecret); } catch (_) {}
        }
        next();
    }

    // ── GET /api/chatbot/config ───────────────────────────────────────────────
    router.get('/config', async (_req, res) => {
        try {
            const [[global_s]] = await db.query(`SELECT * FROM chatbot_settings WHERE portal_key='global'`);
            const [[portal_s]] = await db.query(`SELECT * FROM chatbot_settings WHERE portal_key=?`, [portalKey]);
            const enabled = !!(global_s?.is_enabled) && !!(portal_s?.is_enabled ?? 1);
            res.json({
                success: true,
                data: {
                    enabled,
                    portal_key: portalKey,
                    welcome_message: portal_s?.welcome_message || global_s?.welcome_message || 'Hello! How can I help you?',
                    offline_message: portal_s?.offline_message || global_s?.offline_message || 'We will respond to your question soon.',
                    placeholder_text: portal_s?.placeholder_text || 'Type your question here...',
                }
            });
        } catch (_) {
            res.json({ success: true, data: { enabled: false, portal_key: portalKey } });
        }
    });

    // ── GET /api/chatbot/search?q= ────────────────────────────────────────────
    router.get('/search', async (req, res) => {
        const { q = '' } = req.query;
        if (q.trim().length < 2) return res.json({ success: true, data: { faqs: [], articles: [], answers: [] } });
        const like = `%${q.trim()}%`;
        try {
            const [faqs] = await db.query(
                `SELECT f.id, f.question, f.answer, f.helpful_count, c.name AS category_name
                 FROM faqs f LEFT JOIN kb_categories c ON f.category_id=c.id
                 WHERE f.is_deleted=0 AND f.status='active' AND f.visibility='public'
                   AND (f.question LIKE ? OR f.answer LIKE ?)
                 ORDER BY f.helpful_count DESC, f.view_count DESC LIMIT 5`,
                [like, like]
            );
            const [articles] = await db.query(
                `SELECT k.id, k.title, k.short_description, c.name AS category_name
                 FROM knowledge_base k LEFT JOIN kb_categories c ON k.category_id=c.id
                 WHERE k.is_deleted=0 AND k.status='published' AND k.visibility='public'
                   AND (k.title LIKE ? OR k.short_description LIKE ?)
                 LIMIT 5`,
                [like, like]
            );
            const [answers] = await db.query(
                `SELECT q.id, q.question, a.answer, q.created_at
                 FROM chat_queries q
                 INNER JOIN chat_query_answers a ON a.query_id=q.id
                 WHERE q.is_deleted=0 AND q.visibility='public' AND q.status IN ('answered','published')
                   AND (q.question LIKE ? OR a.answer LIKE ?)
                 ORDER BY q.created_at DESC LIMIT 5`,
                [like, like]
            );
            res.json({ success: true, data: { faqs, articles, answers } });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // ── GET /api/chatbot/faqs ─────────────────────────────────────────────────
    router.get('/faqs', async (req, res) => {
        const { category_id } = req.query;
        let w = "f.is_deleted=0 AND f.status='active' AND f.visibility='public'", p = [];
        if (category_id) { w += ' AND f.category_id=?'; p.push(category_id); }
        try {
            const [rows] = await db.query(
                `SELECT f.id, f.question, f.answer, f.helpful_count, c.name AS category_name
                 FROM faqs f LEFT JOIN kb_categories c ON f.category_id=c.id
                 WHERE ${w} ORDER BY f.sort_order ASC, f.helpful_count DESC LIMIT 30`,
                p
            );
            res.json({ success: true, data: rows });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // ── GET /api/chatbot/categories ───────────────────────────────────────────
    router.get('/categories', async (_req, res) => {
        try {
            const [rows] = await db.query(`SELECT id, name, slug FROM kb_categories WHERE is_active=1 ORDER BY sort_order ASC, name ASC`);
            res.json({ success: true, data: rows });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // ── POST /api/chatbot/query ───────────────────────────────────────────────
    router.post('/query', optAuth, async (req, res) => {
        const { question = '', user_name, user_email, category_id } = req.body;
        if (!question.trim()) return res.status(400).json({ success: false, message: 'Question required' });

        const uid   = req.user?.id   || null;
        const utype = req.user?.role || portalKey;
        const uname = req.user?.name || req.user?.full_name || user_name || null;
        const uemail = req.user?.email || user_email || null;

        if (!uid && !uemail) {
            return res.status(400).json({ success: false, message: 'Email address is required for guest users' });
        }

        try {
            // Smart lookup — check FAQs for similar question
            const like = `%${question.trim().substring(0, 60)}%`;
            const [matched] = await db.query(
                `SELECT id, question, answer FROM faqs
                 WHERE is_deleted=0 AND status='active' AND visibility='public'
                   AND question LIKE ? LIMIT 1`,
                [like]
            );
            if (matched.length > 0) {
                const ref = generateQueryRef();
                await db.execute(
                    `INSERT INTO chat_queries (query_ref, user_id, user_type, user_name, user_email, portal_source,
                     question, category_id, status, visibility, matched_faq_id, is_auto_answered)
                     VALUES (?,?,?,?,?,?,?,?,'answered','private',?,1)`,
                    [ref, uid, utype, uname, uemail, portalKey, question.trim(), category_id||null, matched[0].id]
                );
                return res.json({
                    success: true,
                    auto_answered: true,
                    answer: matched[0].answer,
                    faq_id: matched[0].id,
                    message: 'Instant answer found',
                });
            }

            // No match — create new query
            const ref = generateQueryRef();
            const [r] = await db.execute(
                `INSERT INTO chat_queries (query_ref, user_id, user_type, user_name, user_email, portal_source,
                 question, category_id, status, visibility)
                 VALUES (?,?,?,?,?,?,?,?,'new','private')`,
                [ref, uid, utype, uname, uemail, portalKey, question.trim(), category_id||null]
            );
            res.json({
                success: true,
                auto_answered: false,
                query_id: r.insertId,
                query_ref: ref,
                message: 'Your question has been submitted. You will be notified once the admin responds.',
            });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // ── GET /api/chatbot/my-queries ───────────────────────────────────────────
    router.get('/my-queries', optAuth, async (req, res) => {
        const { user_email } = req.query;
        let w = 'q.is_deleted=0', p = [];
        if (req.user?.id) { w += ' AND q.user_id=?'; p.push(req.user.id); }
        else if (user_email) { w += ' AND q.user_email=?'; p.push(user_email); }
        else return res.json({ success: true, data: [] });
        try {
            const [rows] = await db.query(
                `SELECT q.query_ref, q.id, q.question, q.status, q.visibility, q.created_at, q.priority,
                        a.answer, a.created_at AS answered_at
                 FROM chat_queries q
                 LEFT JOIN chat_query_answers a ON a.query_id=q.id
                 WHERE ${w} ORDER BY q.created_at DESC LIMIT 20`,
                p
            );
            res.json({ success: true, data: rows });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    // ── GET /api/chatbot/notifications/unread ─────────────────────────────────
    router.get('/notifications/unread', optAuth, async (req, res) => {
        const { user_email } = req.query;
        let w = 'is_read=0', p = [];
        if (req.user?.id) { w += ' AND user_id=?'; p.push(req.user.id); }
        else if (user_email) { w += ' AND user_email=?'; p.push(user_email); }
        else return res.json({ success: true, count: 0, data: [] });
        try {
            const [[{count}]] = await db.query(`SELECT COUNT(*) AS count FROM chatbot_notifications WHERE ${w}`, p);
            const [rows]      = await db.query(`SELECT * FROM chatbot_notifications WHERE ${w} ORDER BY created_at DESC LIMIT 10`, p);
            res.json({ success: true, count: parseInt(count), data: rows });
        } catch (_) {
            res.json({ success: true, count: 0, data: [] });
        }
    });

    // ── POST /api/chatbot/notifications/mark-read ─────────────────────────────
    router.post('/notifications/mark-read', optAuth, async (req, res) => {
        const { ids } = req.body;
        if (!ids?.length) return res.json({ success: true });
        try {
            await db.execute(
                `UPDATE chatbot_notifications SET is_read=1 WHERE id IN (${ids.map(() => '?').join(',')})`,
                ids
            );
        } catch (_) {}
        res.json({ success: true });
    });

    // ── POST /api/chatbot/faqs/:id/helpful ────────────────────────────────────
    router.post('/faqs/:id/helpful', async (req, res) => {
        try {
            await db.execute(`UPDATE faqs SET helpful_count=helpful_count+1, view_count=view_count+1 WHERE id=?`, [req.params.id]);
        } catch (_) {}
        res.json({ success: true });
    });

    return router;
};
