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
    const valid = ['Approved', 'Rejected', 'Pending'];
    if (!valid.includes(status)) throw Object.assign(new Error('Invalid status'), { status: 400 });

    const centre = await repo.findById(id);
    if (!centre) throw Object.assign(new Error('Research centre not found'), { status: 404 });

    await repo.updateStatus(id, { status, rejection_reason, approved_by });

    // Enqueue notification if approved or rejected
    if (status === 'Approved' || status === 'Rejected') {
        const subject = status === 'Approved' ? 'Research Centre Application Approved' : 'Research Centre Application Update';
        const title = status === 'Approved' ? 'Centre Verification Successful' : 'Application Update';
        const message = status === 'Approved' 
            ? `The application for <b>${centre.name}</b> has been <b>Approved</b> as a recognized PhD Research Centre. You can now use the portal for supervisor and candidate management.`
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
    const nullableInt = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v) : null;
    const nullable = v => (v !== undefined && v !== '') ? v : null;
    const nullableDate = v => (v && v !== '') ? v : null;

    const data = {
        centre_ref_no:            nullable(body.centre_ref_no),
        centre_type_id:           nullableInt(body.centre_type_id),
        subject_id:               nullableInt(body.subject_id),
        name:                     body.name,
        abbreviation:             nullable(body.abbreviation),
        category_id:              nullableInt(body.category_id),
        institute_id:             nullableInt(body.institute_id),
        institute_name_override:  nullable(body.institute_name_override),
        institute_abbreviation:   nullable(body.institute_abbreviation),
        address_1:                nullable(body.address_1),
        address_2:                nullable(body.address_2),
        address_3:                nullable(body.address_3),
        district_id:              nullableInt(body.district_id),
        pincode:                  nullable(body.pincode),
        contact_number:           nullable(body.contact_number),
        email:                    nullable(body.email),
        recognition_date:         nullableDate(body.recognition_date),
        hod_email:                nullable(body.hod_email),
        remark:                   nullable(body.remark),
        is_active:                body.is_active === 'false' || body.is_active === false ? 0 : 1,
    };

    if (files) {
        if (files.recognition_certificate) data.recognition_certificate = `/uploads/centres/${files.recognition_certificate[0].filename}`;
        if (files.logo)                    data.logo                    = `/uploads/centres/${files.logo[0].filename}`;
    }

    if (!data.recognition_certificate && existing.recognition_certificate) data.recognition_certificate = existing.recognition_certificate;
    if (!data.logo && existing.logo)                                        data.logo                    = existing.logo;

    return data;
}

module.exports = { list, get, create, update, updateStatus, remove };
