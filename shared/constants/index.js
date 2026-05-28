/**
 * Application-wide constants shared across all modules.
 */

const ROLES = {
    STUDENT:    'student',
    ADMIN:      'admin',
    SUPERVISOR: 'supervisor',
    CENTER:     'center',
};

const APPLICATION_STATUS = {
    DRAFT:     'Draft',
    SUBMITTED: 'Submitted',
    APPROVED:  'Approved',
    REJECTED:  'Rejected',
};

const PAYMENT_STATUS = {
    PENDING:   'Pending',
    PAID:      'Paid',
    FAILED:    'Failed',
    WAIVED:    'Waived',
};

const DIRECT_PASS_QUALIFICATIONS = ['NET', 'SET', 'JRF', 'SLET'];

const PORTS = {
    STUDENT_BACKEND:    parseInt(process.env.STUDENT_BACKEND_PORT  || '5000'),
    ADMIN_BACKEND:      parseInt(process.env.ADMIN_BACKEND_PORT    || '5001'),
    SUPERVISOR_BACKEND: parseInt(process.env.SUPERVISOR_BACKEND_PORT || '5002'),
    CENTER_BACKEND:     parseInt(process.env.CENTER_BACKEND_PORT   || '5003'),
};

module.exports = { ROLES, APPLICATION_STATUS, PAYMENT_STATUS, DIRECT_PASS_QUALIFICATIONS, PORTS };
