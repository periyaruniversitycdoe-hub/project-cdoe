const db = require('./config/db');
const { sendWelcomeEmail } = require('./services/emailService');

(async () => {
    console.log('Dispatching a real visual welcome email with Periyar University logo...');
    try {
        const result = await sendWelcomeEmail({
            to: 'afzal22122004@gmail.com',
            studentName: 'Afzal',
            applicationId: 'PU-PHD-2026-8941',
            loginUrl: 'http://localhost:5173/login'
        });
        
        if (!result.success) {
            throw new Error(result.error);
        }

        console.log('✅ Visual Welcome Email enqueued successfully!');
        
        // Find the newly enqueued ID
        const [qRows] = await db.query('SELECT id FROM email_queue WHERE to_email = ? ORDER BY id DESC LIMIT 1', ['afzal22122004@gmail.com']);
        if (qRows.length === 0) {
            throw new Error('Could not find the enqueued email job in the database.');
        }
        const insertId = qRows[0].id;
        
        console.log('Enqueued Job ID:', insertId);
        console.log('Waiting 10 seconds for the background worker to poll, compile inline CID attachments, and dispatch...');
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const [rows] = await db.query('SELECT status, error_log, updated_at FROM email_queue WHERE id = ?', [insertId]);
        const job = rows[0];
        
        console.log('\nResult of queue processing:');
        console.log('---------------------------');
        console.log('Status:', job.status);
        if (job.status === 'completed') {
            console.log('✅ SUCCESS! The background worker compiled, attached, and sent the visual university logo email in real-time!');
            
            // Check email_logs table
            const [logs] = await db.query('SELECT * FROM email_logs WHERE recipient_email = ? ORDER BY sent_at DESC LIMIT 1', ['afzal22122004@gmail.com']);
            if (logs.length > 0) {
                console.log('✅ SUCCESS! Found matching transmission audit log in email_logs:');
                console.log(JSON.stringify(logs[0], null, 2));
            } else {
                console.error('❌ ERROR: Could not find any transmission log in email_logs table for this recipient.');
            }
        } else if (job.status === 'failed') {
            console.error('❌ FAILED! Error:', job.error_log);
            
            // Check email_logs table for failure record
            const [logs] = await db.query('SELECT * FROM email_logs WHERE recipient_email = ? ORDER BY sent_at DESC LIMIT 1', ['afzal22122004@gmail.com']);
            if (logs.length > 0) {
                console.log('✅ Found failure audit log in email_logs:');
                console.log(JSON.stringify(logs[0], null, 2));
            }
        } else {
            console.warn('⚠️ STILL PENDING/PROCESSING. Current Status:', job.status);
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during queue insert/check:', err.message);
        process.exit(1);
    }
})();
