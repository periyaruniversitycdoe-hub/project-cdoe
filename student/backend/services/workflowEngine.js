'use strict';

/**
 * WorkflowEngine — centralized workflow state and access-control logic.
 *
 * All eligibility decisions, time-window checks, and PASS/FAIL calculations
 * are derived here. Routes and API handlers import from this module to avoid
 * duplicating logic.
 *
 * SAFE EXTENSION: nothing in this file mutates the database; it is pure
 * computation on data already fetched by the caller.
 */

// ─── Time-window helpers ──────────────────────────────────────────────────────

/**
 * Return true if the current server time is within [open, close].
 * If both are null/undefined the window is considered always-open (backward
 * compatible with settings that have never been configured).
 */
function isWithinWindow(open, close) {
  const now = Date.now();
  if (open  && new Date(open).getTime()  > now) return false; // not started yet
  if (close && new Date(close).getTime() < now) return false; // already closed
  return true;
}

/**
 * Build a page-access map from the university_settings row.
 *
 * Semantics:
 *   enabled = false → always accessible (feature not restricted yet, backward compat)
 *   enabled = true  → only accessible within the configured time window
 *
 * Consumer should check `active` for gate decisions.
 */
function getPageAccess(settings = {}) {
  const makeWindow = (enabledField, openField, closeField) => {
    const enabled = !!settings[enabledField];
    const open    = settings[openField]  || null;
    const close   = settings[closeField] || null;
    return {
      enabled,
      active: !enabled || isWithinWindow(open, close),
      open,
      close,
    };
  };

  return {
    registration:   makeWindow('apply_now_enabled',       'apply_now_open',       'apply_now_close'),
    payment:        makeWindow('payment_enabled',          'payment_open',         'payment_close'),
    hallTicket:     makeWindow('hall_ticket_enabled',      'hall_ticket_open',     'hall_ticket_close'),
    applicantLogin: makeWindow('applicant_login_enabled',  'applicant_login_open', 'applicant_login_close'),
    resultPublish:  makeWindow('result_publish_enabled',   'result_publish_open',  'result_publish_close'),
  };
}

// ─── Final result computation ─────────────────────────────────────────────────

/**
 * Canonical PASS/FAIL derivation for a single application row.
 */
function computeFinalResult(app, passingMark = 50) {
  const isExempted   = app.entrance_exam_status === 'Exempted';
  const isDirectPass = app.direct_pass_status   === 'DirectPass';

  // Direct Admission Group
  if (isDirectPass || isExempted) return 'PASS';

  // Entrance Group
  if (app.attendance_status === 'Absent') return 'FAIL';
  if (app.entrance_mark == null)          return 'Pending';
  
  const mark = parseFloat(app.entrance_mark);
  const pass = parseFloat(passingMark);
  
  return mark >= pass ? 'PASS' : 'FAIL';
}

// ─── Counselling eligibility ──────────────────────────────────────────────────

/**
 * Returns { eligible, reason } for counselling access.
 * Enterprise 4-Gate Logic:
 * 1. Result PASS
 * 2. Payment PAID
 * 3. Results PUBLISHED
 * 4. Window ACTIVE
 */
function checkCounsellingAccess(app, counsellingWindow, { entranceResultPublished, resultPublishEnabled, resultPublishOpen, resultPublishClose } = {}) {
  const isExempted   = app.entrance_exam_status === 'Exempted';
  const isDirectPass = app.direct_pass_status   === 'DirectPass';

  // [GATE 1] Result
  const isPassed = app.final_result_status === 'PASS' || isDirectPass || isExempted;
  if (!isPassed) {
    return { eligible: false, reason: 'Your final admission result is not yet Qualified.' };
  }

  // [GATE 2] Payment
  if (app.payment_status !== 'Paid') {
    return { eligible: false, reason: 'Counselling Restricted: Admission fee payment is not verified.' };
  }

  // [GATE 3] Publication
  const pageAccess = getPageAccess({
    result_publish_enabled: resultPublishEnabled,
    result_publish_open: resultPublishOpen,
    result_publish_close: resultPublishClose
  });
  const resultsAvailable = !!app.result_published_at || !!entranceResultPublished || (!!resultPublishEnabled && pageAccess.resultPublish.active);
  if (!resultsAvailable) {
    return { eligible: false, reason: 'Access Restricted: Results have not been officially published.' };
  }

  // [GATE 4] Date Window
  if (counsellingWindow) {
    const now = Date.now();
    if (counsellingWindow.start_date && new Date(counsellingWindow.start_date).getTime() > now) {
      return { eligible: false, reason: 'The counselling window has not opened yet.' };
    }
    if (counsellingWindow.end_date && new Date(counsellingWindow.end_date).getTime() < now) {
      return { eligible: false, reason: 'The counselling window for this session has closed.' };
    }
  }

  return { eligible: true, reason: null };
}

// ─── Student workflow stage ───────────────────────────────────────────────────

/**
 * Derives the named workflow stage for display on the student dashboard.
 *
 * Stages (in order):
 *   'draft'              → application not yet submitted
 *   'submitted'          → submitted, payment pending
 *   'paid_pending'       → paid, awaiting admin approval
 *   'approved_exam'      → approved + hall ticket issued (going to exam)
 *   'exempted'           → direct-pass / exempted from entrance
 *   'result_pending'     → exam done, result not published yet
 *   'pass'               → passed
 *   'fail'               → failed
 *   'counselling'        → counselling in progress
 *   'allotted'           → counselling allotment done
 */
function getWorkflowStage(app) {
  if (!app) return 'draft';

  const isDirectPass = app.direct_pass_status === 'DirectPass';

  if (app.status === 'Draft') return 'draft';
  if (app.payment_status !== 'Paid') return 'submitted';
  if (isDirectPass) return 'exempted';
  if (app.status === 'Approved') {
    // Has hall ticket?
    if (app.hall_ticket_number) return 'approved_exam';
    return 'paid_pending';
  }
  if (app.status === 'Submitted') return 'paid_pending';

  if (!app.result_published_at) return 'result_pending';
  if (app.final_result_status === 'PASS') {
    if (app.counselling_submitted_at) return 'allotted';
    return 'pass';
  }
  if (app.final_result_status === 'FAIL') return 'fail';

  return 'result_pending';
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  isWithinWindow,
  getPageAccess,
  computeFinalResult,
  checkCounsellingAccess,
  getWorkflowStage,
};
