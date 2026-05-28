const pool = require('../config/db');

class EntranceFlowDependencyEngine {
    
    /**
     * CASCADE TIER 1: When a Hall Ticket is revoked/deleted
     * This physically removes their access from Attendance, Marks, and Result Processing completely.
     */
    static async onHallTicketRevoked(applicationId, conn = null) {
        const db = conn || pool;
        
        // Cascade 1: Reset the attendance log if they were already marked
        // This implicitly removes them from result processing because they no longer have attendance
        await db.execute(`
            UPDATE applications 
            SET attendance_status = NULL, 
                entrance_mark = NULL, 
                qualification_status = 'Pending', 
                final_result_status = NULL,
                updated_at = NOW()
            WHERE application_id = ?
        `, [applicationId]);
    }

    /**
     * CASCADE TIER 2: When an Application is deleted or revoked entirely
     * Cleans up Hall Tickets, Venues references, Attendance records, Results.
     */
    static async onApplicationRevoked(applicationId, conn = null) {
        const db = conn || pool;
        
        // 1. Delete generated Hall Tickets explicitly
        await db.execute(`DELETE FROM hall_tickets WHERE application_id = ?`, [applicationId]);
        
        // 2. Cascade Attendance and Marks reset
        await db.execute(`
            UPDATE applications 
            SET attendance_status = NULL, 
                entrance_mark = NULL, 
                final_result_status = NULL,
                updated_at = NOW()
            WHERE application_id = ?
        `, [applicationId]);
    }

    /**
     * CASCADE TIER 5: When an Application Payment is revoked / fails
     * Revokes Hall Ticket completely (which naturally bubbles to deleting attendance/marks)
     */
    static async onPaymentRevoked(applicationId, conn = null) {
        const db = conn || pool;
        
        // 1. Delete the hall ticket
        await db.execute(`DELETE FROM hall_tickets WHERE application_id = ?`, [applicationId]);
        
        // 2. Cascade down to attendance and marks by reusing Tier 1 logic
        await this.onHallTicketRevoked(applicationId, db);
    }

    /**
     * CASCADE TIER 3: When a Venue Department Allocation changes or Venue gets deleted
     * Any hall ticket generated for it must be invalidated OR updated. 
     */
    static async syncVenueCapacity(venueId, conn = null) {
        // Reserved for extended master tracking
    }
    
    /**
     * CASCADE TIER 4: When a Master Department Name is updated
     * Automatically cascade this change to matching Venues and Hall Tickets.
     * We synchronize 'department' text fields to maintain consistency.
     */
    static async onDepartmentChanged(oldName, newName, conn = null) {
        const db = conn || pool;
        
        // Update Venue records
        await db.execute(`
            UPDATE venues 
            SET department = ?
            WHERE department = ?
        `, [newName, oldName]);
        
        // Update Hall Ticket records
        await db.execute(`
            UPDATE hall_tickets 
            SET department = ?
            WHERE department = ?
        `, [newName, oldName]);
        
        // We typically do NOT rename standard application 'subject' here 
        // because admission subjects might be officially different than Hall Venue groupings.
        // But for strict workflow tracking, venues/HTs must remain aligned.
    }
}

module.exports = EntranceFlowDependencyEngine;
