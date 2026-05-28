/**
 * FinalEligibilityEngine — Ph.D. Admission Portal (Enterprise Edition)
 * Centralized automation engine for result computation and counselling access.
 * 
 * Objectives:
 * 1. Calculate Entrance Results (PASS/FAIL) vs Passing Marks.
 * 2. Handle Direct Qualification Exemptions (NET/SET/JRF etc).
 * 3. Automate Counselling Eligibility (Remove Manual Approval dependency).
 * 4. Deprecate Interview workflow references.
 */

const pool = require('../config/db');

/**
 * Enterprise Logic Engine
 * @param {object} app { entrance_exam_status, direct_pass_status, entrance_mark, attendance_status, passing_mark }
 */
function computeAutomatedState(app) {
    const isDirectPass = app.direct_pass_status === 'DirectPass';
    const isExempted   = app.entrance_exam_status === 'Exempted';

    // SECTION 3: CASE 2 — DIRECT QUALIFICATION STUDENT
    if (isDirectPass || isExempted) {
        return {
            final_result_status: 'PASS',
            qualification_status: 'Direct Qualified',
            eligible_for_counselling: true,
            needs_entrance: false
        };
    }

    // Attendance Gate
    if (app.attendance_status === 'Absent') {
        return {
            final_result_status: 'FAIL',
            qualification_status: 'Absent',
            eligible_for_counselling: false,
            needs_entrance: true
        };
    }

    // Pending Marks Gate
    if (app.entrance_mark === null || app.entrance_mark === undefined) {
        return {
            final_result_status: 'Pending',
            qualification_status: 'Pending',
            eligible_for_counselling: false,
            needs_entrance: true
        };
    }

    // SECTION 3: CASE 1 — ENTRANCE STUDENT
    const passMark = parseFloat(app.passing_mark || 50);
    const mark     = parseFloat(app.entrance_mark);
    const isPassed = mark >= passMark;

    return {
        final_result_status: isPassed ? 'PASS' : 'FAIL',
        qualification_status: isPassed ? 'Qualified' : 'Failed',
        eligible_for_counselling: isPassed,
        needs_entrance: true
    };
}

/**
 * Automated Result Processor
 * Persists final computed state to DB.
 */
async function recomputeFinalResult(db, appId) {
    const [[app]] = await db.execute(`
        SELECT a.entrance_exam_status, a.direct_pass_status, a.entrance_mark, a.attendance_status,
               es.passing_mark
        FROM applications a
        LEFT JOIN entrance_settings es ON es.id = 1
        WHERE a.id = ?
    `, [appId]);

    if (!app) return null;

    const state = computeAutomatedState(app);

    // SECTION 2 & 10: REMOVE COUNSELLING APPROVAL WORKFLOW
    // We set counselling_approval to 'Approved' for PASS students to allow 
    // instant access through legacy gates, but the system now relies on state.isPassed.
    const autoApproval = state.final_result_status === 'PASS' ? 'Approved' : 'Pending';

    await db.execute(`
        UPDATE applications 
        SET final_result_status = ?, 
            qualification_status = ?, 
            counselling_approval = ?,
            interview_status = 'N/A',
            updated_at = NOW() 
        WHERE id = ?
    `, [state.final_result_status, state.qualification_status, autoApproval, appId]);

    return { ...state, counselling_approval: autoApproval };
}

/**
 * UI State Snapshot
 */
function buildEligibilitySnapshot(app) {
    const isExempted = app.entrance_exam_status === 'Exempted' || app.direct_pass_status === 'DirectPass';
    const isPassed   = app.final_result_status === 'PASS';
    
    // SECTION 7: COUNSELLING ACTIVATION LOGIC (GATE 1, 2, 3)
    const eligibleForCounselling = isPassed && app.payment_status === 'Paid';

    return {
        is_exempted: isExempted,
        final_result_status: app.final_result_status,
        qualification_status: app.qualification_status,
        eligible_for_hall_ticket: !isExempted && app.status === 'Approved' && app.payment_status === 'Paid',
        eligible_for_counselling: eligibleForCounselling,
        entrance_passed: isPassed || isExempted
    };
}

module.exports = { 
    computeAutomatedState, 
    recomputeFinalResult, 
    buildEligibilitySnapshot 
};
