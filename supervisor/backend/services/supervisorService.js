const repo            = require('../repositories/supervisorRepository');
const centreRepo      = require('../../../center/backend/repositories/centreRepository');
const capacityEngine  = require('./SupervisorCapacityEngine');
const { validateSupervisor } = require('../validators/supervisorValidator');
const { enqueueEmail } = require('../../../shared/utils/notification');
const pool = require('../config/db');
const path = require('path');
const fs   = require('fs');

const UPLOAD_BASE = path.join(__dirname, '../../../admin/backend/uploads/supervisors');
if (!fs.existsSync(UPLOAD_BASE)) fs.mkdirSync(UPLOAD_BASE, { recursive: true });

async function list(filters) {
    return repo.findAll(filters);
}

async function get(id) {
    const supervisor = await repo.findById(id);
    if (!supervisor) throw Object.assign(new Error('Supervisor not found'), { status: 404 });
    const disciplines = await repo.getDisciplines(id);
    return { ...supervisor, disciplines };
}

async function create(body, files) {
    const errors = validateSupervisor(body);
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 422 });

    if (body.email) {
        const taken = await repo.isEmailTaken(body.email);
        if (taken) throw Object.assign(new Error('Email already registered'), { status: 409 });
    }

    const data = await buildSupervisorData(body, files);

    // For a new supervisor: current_vacancy = max_candidates (no scholars yet)
    const capacityDetails = await capacityEngine.calculateCapacityDetails(data.designation_id);
    data.max_candidates   = data.max_candidates || capacityDetails.max_candidates || 0;
    data.current_vacancy  = data.current_vacancy !== null && data.current_vacancy !== undefined ? data.current_vacancy : capacityDetails.current_vacancy;
    data.max_full_time    = data.max_full_time || capacityDetails.max_full_time;
    data.max_part_time    = data.max_part_time || capacityDetails.max_part_time;
    data.current_scholars_count           = 0;
    data.current_part_time_scholars_count = 0;

    const id = await repo.create(data);

    if (body.disciplines) {
        const disciplines = JSON.parse(body.disciplines);
        await repo.upsertDisciplines(id, disciplines);
    }

    return repo.findById(id);
}

async function update(id, body, files) {
    const existing = await repo.findById(id);
    if (!existing) throw Object.assign(new Error('Supervisor not found'), { status: 404 });

    const errors = validateSupervisor(body, true);
    if (errors.length) throw Object.assign(new Error(errors.join('; ')), { status: 422 });

    if (body.email && body.email !== existing.email) {
        const taken = await repo.isEmailTaken(body.email, id);
        if (taken) throw Object.assign(new Error('Email already in use'), { status: 409 });
    }

    const data = await buildSupervisorData(body, files, existing);

    // Recalculate vacancy based on current scholars count
    const scholarsCount   = existing.current_scholars_count           || 0;
    const ptScholarsCount = existing.current_part_time_scholars_count || 0;
    const designationId   = data.designation_id || existing.designation_id;

    if (designationId) {
        const cap = await capacityEngine.calculateCapacityDetails(designationId, scholarsCount, ptScholarsCount);
        data.max_candidates  = data.max_candidates || cap.max_candidates;
        data.current_vacancy = data.current_vacancy !== null && data.current_vacancy !== undefined ? data.current_vacancy : cap.current_vacancy;
        data.max_full_time   = data.max_full_time || cap.max_full_time;
        data.max_part_time   = data.max_part_time || cap.max_part_time;
    }

    await repo.update(id, data);

    if (body.disciplines !== undefined) {
        const disciplines = JSON.parse(body.disciplines);
        await repo.upsertDisciplines(id, disciplines);
    }

    return get(id);
}

async function updateStatus(id, { status, rejection_reason, approved_by }) {
    const valid = ['Active', 'Inactive', 'Pending', 'Approved', 'Rejected'];
    if (!valid.includes(status)) throw Object.assign(new Error('Invalid status'), { status: 400 });
    
    // Fetch current state to see if it changed
    const supervisor = await repo.findById(id);
    if (!supervisor) throw Object.assign(new Error('Supervisor not found'), { status: 404 });

    await repo.updateStatus(id, { status, rejection_reason, approved_by });

    // Enqueue notification if approved or rejected
    if (status === 'Approved' || status === 'Rejected') {
        const subject = status === 'Approved' ? 'Supervisor Application Approved' : 'Supervisor Application Update';
        const title = status === 'Approved' ? 'Congratulations!' : 'Application Update';
        const message = status === 'Approved' 
            ? `Your application to be a PhD Supervisor at Periyar University has been <b>Approved</b>. You can now log in to your portal to complete your profile.`
            : `Your application to be a PhD Supervisor has been reviewed. Status: <b>Rejected</b>.${rejection_reason ? `<br><br><b>Reason:</b> ${rejection_reason}` : ''}<br><br>Please contact the university administration for further details.`;

        if (supervisor.email) {
            // Find linked user for in-app notification
            const [[user]] = await pool.execute('SELECT id FROM supervisor_users WHERE email = ?', [supervisor.email]);
            
            await enqueueEmail(pool, {
                to_email: supervisor.email,
                subject,
                title,
                message,
                user_id: user ? user.id : null,
                target_type: 'supervisor',
                type: status === 'Approved' ? 'success' : 'error'
            });
        }
    }

    return repo.findById(id);
}

async function remove(id) {
    const count = await repo.remove(id);
    if (!count) throw Object.assign(new Error('Supervisor not found'), { status: 404 });
}

async function removeAll() {
    return repo.removeAll();
}

async function getActiveCentres() {
    return centreRepo.findAllActive();
}

async function buildSupervisorData(body, files, existing = {}) {
    const nullableInt  = v => (v !== undefined && v !== '' && v !== null) ? parseInt(v) : null;
    const nullable     = v => (v !== undefined && v !== '') ? v : null;
    const nullableDate = v => (v && v !== '') ? v : null;
    const upperOrNull  = v => (v && String(v).trim()) ? String(v).toUpperCase() : null;

    const data = {
        name:                    body.name,
        gender:                  body.gender || 'Male',
        designation_id:          nullableInt(body.designation_id),
        recognition_ref_no:      nullable(body.recognition_ref_no),
        department_id:           nullableInt(body.department_id),
        area_of_specialization:  nullable(body.area_of_specialization),
        serving_institute_id:    nullableInt(body.serving_institute_id),
        university_institute_id: nullableInt(body.university_institute_id),
        research_center_id:      nullableInt(body.research_center_id),
        address_1:               nullable(body.address_1),
        address_2:               nullable(body.address_2),
        address_3:               nullable(body.address_3),
        district_id:             nullableInt(body.district_id),
        pincode:                 nullable(body.pincode),
        aadhaar_no:              nullable(body.aadhaar_no),
        mobile:                  nullable(body.mobile),
        email:                   nullable(body.email),
        dob:                     nullableDate(body.dob),
        date_of_joining:         nullableDate(body.date_of_joining),
        date_of_superannuation:  nullableDate(body.date_of_superannuation),
        max_candidates:          nullableInt(body.max_candidates) ?? 0,
        current_vacancy:         nullableInt(body.current_vacancy) ?? 0,
        max_part_time:           nullableInt(body.max_part_time)   ?? 0,
        max_full_time:           nullableInt(body.max_full_time)   ?? 0,
        bank_holder_name:        upperOrNull(body.bank_holder_name),
        bank_name:               upperOrNull(body.bank_name),
        account_number:          nullable(body.account_number),
        ifsc_code:               upperOrNull(body.ifsc_code),
        remarks:                 nullable(body.remarks),
    };

    if (files) {
        if (files.profile_image)
            data.profile_image = `/uploads/supervisors/${files.profile_image[0].filename}`;
        if (files.dob_evidence)
            data.dob_evidence  = `/uploads/supervisors/${files.dob_evidence[0].filename}`;
        if (files.recognition_certificate)
            data.recognition_certificate = `/uploads/supervisors/${files.recognition_certificate[0].filename}`;
    }

    if (!data.profile_image && existing.profile_image)
        data.profile_image = existing.profile_image;
    if (!data.dob_evidence && existing.dob_evidence)
        data.dob_evidence  = existing.dob_evidence;
    if (!data.recognition_certificate && existing.recognition_certificate)
        data.recognition_certificate = existing.recognition_certificate;

    return data;
}

async function listCapacityConfigs() {
    return capacityEngine.getAllConfigs();
}

async function upsertCapacityConfig(body) {
    const { designation_id, max_capacity, status } = body;
    if (!designation_id || max_capacity === undefined) throw Object.assign(new Error('Missing required fields'), { status: 400 });
    return capacityEngine.upsertConfig(designation_id, max_capacity, status);
}

async function getCapacityByDesignation(designationId) {
    return capacityEngine.calculateCapacityDetails(designationId);
}

async function getFilterOptions() {
    return repo.getFilterOptions();
}

module.exports = { list, get, create, update, updateStatus, remove, removeAll, getActiveCentres, listCapacityConfigs, upsertCapacityConfig, getCapacityByDesignation, getFilterOptions };
