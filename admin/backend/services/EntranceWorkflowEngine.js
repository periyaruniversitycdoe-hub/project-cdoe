const pool = require('../config/db');

class EntranceWorkflowEngine {
    /**
     * Step 2/3: Validate if student can generate Hall Ticket
     * Must be: Payment Approved (Paid & Approved), NOT Exempted
     */
    static async validateHallTicketEligibility(applicationId) {
        const [[app]] = await pool.execute(`
            SELECT payment_status, status, entrance_exam_status 
            FROM applications 
            WHERE application_id = ?
        `, [applicationId]);

        if (!app) return { eligible: false, message: 'Application not found' };
        
        if (app.entrance_exam_status === 'Exempted') {
            return { eligible: false, message: 'Student is exempted from entrance exam.' };
        }
        
        if (app.status !== 'Approved') {
            return { eligible: false, message: 'Application is not approved.' };
        }
        
        if (app.payment_status !== 'Paid') {
            return { eligible: false, message: 'Payment is not verified/approved.' };
        }

        return { eligible: true };
    }

    /**
     * Helper to get Passing Mark
     */
    static async getPassingMark() {
        const [[criteria]] = await pool.execute('SELECT passing_mark FROM entrance_settings LIMIT 1');
        return criteria && criteria.passing_mark != null ? parseFloat(criteria.passing_mark) : 50;
    }

    /**
     * Step 5: Process Entrance Marks & Calculate Result
     */
    static async processResult(applicationId, conn = null) {
        const db = conn || pool;
        const [[app]] = await db.execute(`
            SELECT entrance_exam_status, entrance_mark, attendance_status 
            FROM applications 
            WHERE application_id = ?
        `, [applicationId]);

        if (!app) throw new Error("Application not found");

        if (app.entrance_exam_status === 'Exempted') {
            await db.execute(`
                UPDATE applications 
                SET qualification_status = 'Qualified', 
                    final_result_status = 'PASS',
                    updated_at = NOW()
                WHERE application_id = ?
            `, [applicationId]);
            return;
        }

        const passingMark = await this.getPassingMark();
        let qualStatus = 'Pending';
        let finalResult = null;

        if (app.attendance_status === 'Absent') {
            qualStatus = 'Absent';
            finalResult = 'FAIL';
        } else if (app.entrance_mark !== null) {
            qualStatus = parseFloat(app.entrance_mark) >= passingMark ? 'Qualified' : 'Failed';
            finalResult = qualStatus === 'Qualified' ? 'PASS' : 'FAIL';
        }

        await db.execute(`
            UPDATE applications 
            SET qualification_status = ?, 
                final_result_status = ?,
                updated_at = NOW()
            WHERE application_id = ?
        `, [qualStatus, finalResult, applicationId]);
    }
}

module.exports = EntranceWorkflowEngine;
