/**
 * seed_news_announcements.js
 * --------------------------
 * Seeds the news_announcements and news_announcement_categories tables
 * with real sample data for Periyar University PhD Portal.
 *
 * Run: node scripts/seed_news_announcements.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const DB_CONFIG = {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:      process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 30000,
};

async function run() {
    let conn;
    try {
        console.log('\n📡 Connecting to database...');
        conn = await mysql.createConnection(DB_CONFIG);
        console.log('✅ Connected to:', DB_CONFIG.host);

        // ── 1. Create categories table ────────────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS news_announcement_categories (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                category_key VARCHAR(100) NOT NULL UNIQUE,
                label        VARCHAR(100) NOT NULL,
                icon         VARCHAR(50)  NOT NULL DEFAULT '📢',
                color        VARCHAR(50)  NOT NULL DEFAULT '#7c3aed',
                bg           VARCHAR(50)  NOT NULL DEFAULT '#ede9fe',
                is_active    TINYINT(1)   NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // ── 2. Seed categories ────────────────────────────────────────────────
        await conn.execute(`
            INSERT IGNORE INTO news_announcement_categories (category_key, label, icon, color, bg) VALUES 
            ('news',         'News',         '📰', '#0369a1', '#e0f2fe'),
            ('announcement', 'Announcement', '📢', '#7c3aed', '#ede9fe'),
            ('circular',     'Circular',     '📋', '#0f766e', '#ccfbf1'),
            ('alert',        'Alert',        '🚨', '#dc2626', '#fee2e2'),
            ('deadline',     'Deadline',     '⏰', '#d97706', '#fef3c7'),
            ('event',        'Event',        '🎓', '#059669', '#d1fae5')
        `);
        console.log('✅ Categories seeded.');

        // ── 3. Create news_announcements table ────────────────────────────────
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS news_announcements (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                title            VARCHAR(500)  NOT NULL,
                description      LONGTEXT      NOT NULL,
                category         VARCHAR(100)  NOT NULL DEFAULT 'announcement',
                priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
                audience         ENUM('all','student','supervisor','centre') NOT NULL DEFAULT 'all',
                attachment_path  VARCHAR(500)  NULL,
                attachment_name  VARCHAR(255)  NULL,
                redirect_url     VARCHAR(500)  NULL,
                publish_date     DATETIME      NOT NULL,
                expiry_date      DATETIME      NOT NULL,
                status           ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
                is_pinned        TINYINT(1)    NOT NULL DEFAULT 0,
                created_by       INT           NOT NULL DEFAULT 1,
                created_by_email VARCHAR(255)  NULL,
                updated_by       INT           NULL,
                updated_by_email VARCHAR(255)  NULL,
                is_deleted       TINYINT(1)    NOT NULL DEFAULT 0,
                created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Safely alter category column (ENUM → VARCHAR) in case table already existed
        try {
            await conn.execute(`ALTER TABLE news_announcements MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'announcement'`);
        } catch (_) {}

        // Add redirect_url column if missing
        try {
            await conn.execute(`ALTER TABLE news_announcements ADD COLUMN redirect_url VARCHAR(500) NULL AFTER attachment_name`);
        } catch (_) {}

        console.log('✅ news_announcements table verified.');

        // ── 4. Check existing count ───────────────────────────────────────────
        const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM news_announcements WHERE is_deleted = 0');
        if (cnt > 0) {
            console.log(`ℹ️  Table already has ${cnt} announcements. Skipping seed (use --force to re-seed).`);
            if (!process.argv.includes('--force')) {
                await conn.end();
                return;
            }
            console.log('🔁 --force flag detected, inserting additional seed records...');
        }

        // ── 5. Seed announcements ─────────────────────────────────────────────
        const now   = new Date();
        const soon  = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 19).replace('T', ' '); };
        const past  = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 19).replace('T', ' '); };

        const adminEmail = 'admin@periyaruniversity.ac.in';

        const rows = [
            // ── PINNED URGENT ──────────────────────────────────────────────────
            {
                title:       'PhD Admissions 2024–25: Applications Now Open',
                description: 'Periyar University invites applications for admission to the Doctor of Philosophy (PhD) programme for the academic year 2024–25 across all departments.\n\nEligibility: Candidates must possess a Master\'s Degree with a minimum of 55% marks (50% for SC/ST/PH candidates) in the relevant subject from a recognised university.\n\nHow to Apply:\n1. Register on the PhD Portal at https://phdadmissions.periyaruniversity.ac.in\n2. Fill in the online application form completely.\n3. Upload all required documents (degree certificates, mark sheets, ID proof, passport photo).\n4. Pay the application fee (₹500 for General / ₹250 for SC/ST).\n5. Submit before the deadline.\n\nFor queries, contact: phdadmissions@periyaruniversity.ac.in | +91-427-2345766',
                category:    'announcement',
                priority:    'urgent',
                audience:    'all',
                publish_date: past(0),
                expiry_date:  soon(60),
                status:       'published',
                is_pinned:    1,
            },
            // ── DEADLINE ──────────────────────────────────────────────────────
            {
                title:       'Last Date for PhD Application Submission: ' + new Date(Date.now() + 25 * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
                description: 'This is a reminder that the last date for submitting your PhD application for the 2024–25 batch is approaching fast.\n\nCandidates who have not yet submitted their completed application form along with all required documents and fee payment are advised to do so immediately.\n\nIncomplete applications will not be considered. No extensions will be granted under any circumstances.\n\nPlease check your application status on the portal. Contact the Doctoral Studies Cell for any issues.',
                category:    'deadline',
                priority:    'urgent',
                audience:    'student',
                publish_date: past(2),
                expiry_date:  soon(25),
                status:       'published',
                is_pinned:    1,
            },
            // ── CIRCULAR ──────────────────────────────────────────────────────
            {
                title:       'Circular No. PU/DSC/2024/01 — PhD Research Progress Report Submission',
                description: 'All registered PhD scholars are hereby informed that the Six-Monthly Research Progress Report for the period January–June 2024 must be submitted through the online portal on or before the due date.\n\nThe report must be countersigned by your Research Supervisor and forwarded to the Doctoral Studies Cell.\n\nReports submitted after the due date will attract a late fee of ₹200 per week.\n\nFormat and submission guidelines are available under "Downloads" in the Scholar Portal.',
                category:    'circular',
                priority:    'high',
                audience:    'student',
                publish_date: past(5),
                expiry_date:  soon(30),
                status:       'published',
                is_pinned:    0,
            },
            // ── EVENT ─────────────────────────────────────────────────────────
            {
                title:       'PhD Entrance Examination Schedule — 2024',
                description: 'The Periyar University PhD Entrance Examination for 2024–25 admissions is scheduled as follows:\n\n• Written Test: To be announced on the portal\n• Venue: Main Examination Hall, Periyar University Campus, Salem\n• Reporting Time: 09:00 AM\n• Exam Duration: 2 hours\n\nAdmit cards will be available for download from the portal 5 days before the examination. Candidates must carry a printed copy of the admit card along with a valid photo ID.\n\nNo separate call letters will be sent by post.',
                category:    'event',
                priority:    'high',
                audience:    'student',
                publish_date: past(3),
                expiry_date:  soon(45),
                status:       'published',
                is_pinned:    0,
            },
            // ── NEWS ──────────────────────────────────────────────────────────
            {
                title:       'Periyar University Ranked in NIRF 2024 — University Category',
                description: 'We are proud to announce that Periyar University has been ranked among the top universities in Tamil Nadu in the National Institutional Ranking Framework (NIRF) 2024.\n\nThis achievement reflects the dedication of our faculty, researchers, and students towards academic excellence and research output.\n\nThe ranking considered parameters including Teaching, Learning & Resources, Research & Professional Practice, Graduation Outcomes, Outreach & Inclusivity, and Perception.\n\nCongratulations to all members of the Periyar University community!',
                category:    'news',
                priority:    'medium',
                audience:    'all',
                publish_date: past(7),
                expiry_date:  soon(90),
                status:       'published',
                is_pinned:    0,
            },
            // ── SUPERVISOR SPECIFIC ───────────────────────────────────────────
            {
                title:       'Research Supervisors: Upload Co-Guide Consent Letters',
                description: 'All Research Supervisors who have co-guided scholars are requested to upload the signed Co-Guide Consent Letters through the Supervisor Portal at the earliest.\n\nThis is a mandatory requirement for processing the thesis submission of your scholars. Delay in uploading these documents will result in delay of thesis evaluation.\n\nFor assistance, contact the Doctoral Studies Cell at doctoralstudies@periyaruniversity.ac.in',
                category:    'circular',
                priority:    'high',
                audience:    'supervisor',
                publish_date: past(1),
                expiry_date:  soon(20),
                status:       'published',
                is_pinned:    0,
            },
            // ── CENTRE SPECIFIC ───────────────────────────────────────────────
            {
                title:       'Examination Centres: Biometric Registration Mandatory',
                description: 'All approved PhD Examination Centres are required to ensure that biometric registration of enrolled candidates is completed before the examination date.\n\nCentres that fail to complete biometric registration will not be permitted to conduct the examination, and candidates will be reallocated to alternative centres.\n\nPlease update the centre readiness status on the Centre Management Portal by the specified date.',
                category:    'alert',
                priority:    'high',
                audience:    'centre',
                publish_date: past(2),
                expiry_date:  soon(15),
                status:       'published',
                is_pinned:    0,
            },
            // ── GENERAL INFORMATION ───────────────────────────────────────────
            {
                title:       'Fee Concession for SC/ST/PH Candidates — PhD 2024–25',
                description: 'Eligible candidates belonging to Scheduled Caste (SC), Scheduled Tribe (ST), and Persons with Disabilities (PH) categories are entitled to a 50% concession in the PhD application fee.\n\nTo avail the concession:\n1. Select the appropriate category during registration.\n2. Upload your valid Community Certificate / Disability Certificate.\n3. The system will automatically apply the concession.\n\nCandidates who paid the full fee and later provide community certificates will be refunded the differential amount within 30 working days of admission confirmation.',
                category:    'news',
                priority:    'medium',
                audience:    'student',
                publish_date: past(4),
                expiry_date:  soon(55),
                status:       'published',
                is_pinned:    0,
            },
            // ── ALERT ─────────────────────────────────────────────────────────
            {
                title:       '⚠️ IMPORTANT: Portal Maintenance Window — ' + soon(3).split(' ')[0],
                description: 'Please note that the PhD Admission Portal will undergo scheduled maintenance on ' + soon(3).split(' ')[0] + ' between 11:00 PM and 2:00 AM IST.\n\nDuring this period, the portal will be unavailable. Candidates are advised to:\n• Complete and save any pending form entries before 10:45 PM.\n• Download your application PDF before the maintenance window.\n• Do not attempt to make payments during this period.\n\nWe apologize for any inconvenience caused. The portal will resume normal operations after 2:00 AM.',
                category:    'alert',
                priority:    'medium',
                audience:    'all',
                publish_date: past(1),
                expiry_date:  soon(5),
                status:       'published',
                is_pinned:    0,
            },
            // ── UPCOMING (near future) ────────────────────────────────────────
            {
                title:       'PhD Interview / Viva-Voce Schedule — 2024',
                description: 'Candidates who have qualified in the PhD Entrance Examination will be called for a Viva-Voce / Interview before the Doctoral Committee.\n\nThe schedule will be published on this portal as soon as the entrance exam results are announced.\n\nCandidates are advised to keep checking the portal regularly for updates. No separate communication will be sent.\n\nPlease ensure your contact information and email address on the portal are up to date.',
                category:    'event',
                priority:    'medium',
                audience:    'student',
                publish_date: soon(5),
                expiry_date:  soon(60),
                status:       'published',
                is_pinned:    0,
            },
        ];

        let inserted = 0;
        for (const row of rows) {
            await conn.execute(
                `INSERT INTO news_announcements
                    (title, description, category, priority, audience,
                     attachment_path, attachment_name, redirect_url,
                     publish_date, expiry_date, status, is_pinned,
                     created_by, created_by_email)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    row.title, row.description, row.category, row.priority, row.audience,
                    row.attachment_path || null,
                    row.attachment_name || null,
                    row.redirect_url   || null,
                    row.publish_date, row.expiry_date, row.status, row.is_pinned,
                    1, adminEmail,
                ]
            );
            inserted++;
            console.log(`   ✔  [${row.category.toUpperCase()}] ${row.title.slice(0, 70)}`);
        }

        console.log(`\n🎉 Done! Inserted ${inserted} announcements into news_announcements.\n`);
        console.log('📋 Summary:');
        const [[{ total }]] = await conn.execute('SELECT COUNT(*) AS total FROM news_announcements WHERE is_deleted=0 AND status="published"');
        console.log(`   Total published announcements in DB: ${total}`);
        console.log('\nThe admin can now manage these via the Admin Portal → News & Announcements section.');

    } catch (err) {
        console.error('\n❌ Seed error:', err.message);
        if (err.code) console.error('   Code:', err.code);
    } finally {
        if (conn) await conn.end();
    }
}

run();
