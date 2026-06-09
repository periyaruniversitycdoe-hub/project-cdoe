const repo = require('../repositories/centreRepository');
const { validateCentre } = require('../validators/centreValidator');
const path = require('path');
const fs = require('fs');

const UPLOAD_BASE = path.join(__dirname, '../../../admin/backend/uploads/centres');
if (!fs.existsSync(UPLOAD_BASE)) fs.mkdirSync(UPLOAD_BASE, { recursive: true });

async function list(filters) {
    return repo.findAll(filters);
}

async function get(id) {
    const centre = await repo.findById(id);
    if (!centre) throw Object.assign(new Error('Research centre not found'), { status: 404 });
    return centre;
}

async function create(body, files) {
    const errors = validateCentre(body);
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 422 });

    if (!body.institute_id && body.college_code) {
        const [[inst]] = await pool.execute(
            'SELECT id FROM master_institutes WHERE college_code = ? AND is_active = 1 LIMIT 1',
            [body.college_code.trim()]
        );
        if (inst) body.institute_id = inst.id;
    }

    if (body.centre_ref_no) {
        const taken = await repo.isRefNoTaken(body.centre_ref_no);
        if (taken) throw Object.assign(new Error('Centre reference number already exists'), { status: 409 });
    }

    const data = buildCentreData(body, files);
    const id = await repo.create(data);
    return repo.findById(id);
}

async function update(id, body, files) {
    const existing = await repo.findById(id);
    if (!existing) throw Object.assign(new Error('Research centre not found'), { status: 404 });

    const errors = validateCentre(body, true);
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 422 });

    if (!body.institute_id && body.college_code) {
        const [[inst]] = await pool.execute(
            'SELECT id FROM master_institutes WHERE college_code = ? AND is_active = 1 LIMIT 1',
            [body.college_code.trim()]
        );
        if (inst) body.institute_id = inst.id;
    }

    if (body.centre_ref_no && body.centre_ref_no !== existing.centre_ref_no) {
        const taken = await repo.isRefNoTaken(body.centre_ref_no, id);
        if (taken) throw Object.assign(new Error('Centre reference number already in use'), { status: 409 });
    }

    const data = buildCentreData(body, files, existing);
    await repo.update(id, data);
    return repo.findById(id);
}

const { enqueueEmail } = require('../../../shared/utils/notification');
const pool = require('../config/db');

async function updateStatus(id, { status, rejection_reason, approved_by }) {
    const valid = ['Approved', 'Rejected', 'Pending', 'Suspended'];
    if (!valid.includes(status)) throw Object.assign(new Error('Invalid status'), { status: 400 });

    const centre = await repo.findById(id);
    if (!centre) throw Object.assign(new Error('Research centre not found'), { status: 404 });

    await repo.updateStatus(id, { status, rejection_reason, approved_by });

    // Enqueue notification if approved, rejected, or suspended
    if (status === 'Approved' || status === 'Rejected' || status === 'Suspended') {
        const subject = status === 'Approved' 
            ? 'Research Centre Application Approved' 
            : status === 'Suspended'
            ? 'Research Centre Suspended'
            : 'Research Centre Application Update';
        const title = status === 'Approved' 
            ? 'Centre Verification Successful' 
            : status === 'Suspended'
            ? 'Centre Status Suspended'
            : 'Application Update';
        const message = status === 'Approved' 
            ? `The application for <b>${centre.name}</b> has been <b>Approved</b> as a recognized PhD Research Centre. You can now use the portal for supervisor and candidate management.`
            : status === 'Suspended'
            ? `The Research Centre recognition for <b>${centre.name}</b> has been <b>Suspended</b> by university administration. Access to supervisor and candidate portal features is temporarily locked.`
            : `The application for <b>${centre.name}</b> has been <b>Rejected</b>.${rejection_reason ? `<br><br><b>Reason:</b> ${rejection_reason}` : ''}<br><br>Please review the remarks and contact the university for clarification.`;

        if (centre.email) {
            // Find linked user for in-app notification
            const [[user]] = await pool.execute('SELECT id FROM center_users WHERE email = ?', [centre.email]);

            await enqueueEmail(pool, {
                to_email: centre.email,
                subject,
                title,
                message,
                user_id: user ? user.id : null,
                target_type: 'center',
                type: status === 'Approved' ? 'success' : 'error'
            });
        }
    }

    return repo.findById(id);
}

async function remove(id) {
    const count = await repo.remove(id);
    if (!count) throw Object.assign(new Error('Research centre not found'), { status: 404 });
}

function buildCentreData(body, files, existing = {}) {
    const nullableInt  = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v) : null;
    const nullable     = v => (v !== undefined && v !== '' && v !== null) ? String(v).trim() || null : null;
    const nullableDate = v => (v && v !== '') ? v : null;

    const data = {
        // Step 0 — Centre Information
        name:             body.name,
        centre_ref_no:    nullable(body.centre_ref_no),
        centre_type_id:   nullableInt(body.centre_type_id),
        subject_id:       nullableInt(body.subject_id),
        category_id:      nullableInt(body.category_id),
        recognition_date: nullableDate(body.recognition_date),

        // Step 1 — Institute Details (master source for Institute Master sync)
        college_code:     nullable(body.college_code),
        college_name:     nullable(body.college_name),
        principal_name:   nullable(body.principal_name),
        principal_mobile: nullable(body.principal_mobile),
        hod_email:        nullable(body.hod_email),
        college_phone:    nullable(body.college_phone),
        // abbreviation kept for backward-compat; mirrors college_code
        abbreviation:     nullable(body.college_code) || nullable(body.abbreviation),

        // institute_id — FK resolved from college_code on submission; kept in sync on approval
        institute_id:     nullableInt(body.institute_id),

        // Step 2 — Address & Contact
        address_1:        nullable(body.address_1),
        address_2:        nullable(body.address_2),
        address_3:        nullable(body.address_3),
        district_id:      nullableInt(body.district_id),
        pincode:          nullable(body.pincode),
        contact_number:   nullable(body.contact_number),
        email:            nullable(body.email),

        remark:           nullable(body.remark),
        is_active:        body.is_active === 'false' || body.is_active === false ? 0 : 1,
        // File paths — populated below; declared here so the object shape is complete
        recognition_certificate: existing.recognition_certificate || null,
        logo:                    existing.logo                    || null,
    };

    if (files) {
        if (files.recognition_certificate) data.recognition_certificate = `/uploads/centres/${files.recognition_certificate[0].filename}`;
        if (files.logo)                    data.logo                    = `/uploads/centres/${files.logo[0].filename}`;
    }

    return data;
}

module.exports = { list, get, create, update, updateStatus, remove };
