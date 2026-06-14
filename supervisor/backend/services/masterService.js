const repo = require('../repositories/masterRepository');

async function list(type, activeOnly) {
    return repo.findAll(type, activeOnly);
}

async function get(type, id) {
    const item = await repo.findById(type, id);
    if (!item) throw Object.assign(new Error('Not found'), { status: 404 });
    return item;
}

async function create(type, payload, adminUser) {
    const { name, abbreviation, max_capacity, full_time_max_capacity, part_time_max_capacity, full_time_required, part_time_required } = payload;
    if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });

    const items = await repo.findAll(type, false);
    if (items.some(item => item.name.toLowerCase() === name.trim().toLowerCase())) {
        throw Object.assign(new Error(`Duplicate name not allowed: ${name.trim()}`), { status: 400 });
    }

    let parsedCapacity = 0, parsedFt = 0, parsedPt = 0;
    if (type === 'designations') {
        parsedCapacity = parseInt(max_capacity);
        if (isNaN(parsedCapacity) || parsedCapacity < 0)
            throw Object.assign(new Error('Maximum scholar capacity must be a non-negative integer'), { status: 400 });

        parsedFt = parseInt(full_time_max_capacity) || 0;
        parsedPt = parseInt(part_time_max_capacity) || 0;
        if (parsedFt < 0 || parsedPt < 0)
            throw Object.assign(new Error('Full-Time and Part-Time capacities must be non-negative'), { status: 400 });
        if (parsedFt + parsedPt > parsedCapacity)
            throw Object.assign(new Error('Combined Full-Time and Part-Time Capacity cannot exceed Max Capacity'), { status: 400 });
    }

    const id = await repo.create(type, {
        name: name.trim(),
        abbreviation: abbreviation?.trim(),
        max_capacity: parsedCapacity,
        full_time_max_capacity: parsedFt,
        part_time_max_capacity: parsedPt,
        full_time_required:  full_time_required  ? 1 : 0,
        part_time_required:  part_time_required  ? 1 : 0,
    });

    const created = await repo.findById(type, id);

    if (type === 'designations') {
        await repo.logDesignationAudit(
            id, created.name, 'CREATE', null, null,
            JSON.stringify({
                name: created.name,
                max_capacity: created.max_capacity,
                full_time_max_capacity: created.full_time_max_capacity,
                part_time_max_capacity: created.part_time_max_capacity,
                full_time_required: created.full_time_required,
                part_time_required: created.part_time_required,
                is_active: 1,
            }),
            adminUser
        );
    }

    return created;
}

async function update(type, id, payload, adminUser) {
    const { name, abbreviation, max_capacity, full_time_max_capacity, part_time_max_capacity, full_time_required, part_time_required, is_active } = payload;
    if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });

    const existing = await repo.findById(type, id);
    if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });

    const items = await repo.findAll(type, false);
    if (items.some(item => item.name.toLowerCase() === name.trim().toLowerCase() && item.id !== parseInt(id))) {
        throw Object.assign(new Error(`Duplicate name not allowed: ${name.trim()}`), { status: 400 });
    }

    let parsedCapacity = 0, parsedFt = 0, parsedPt = 0;
    if (type === 'designations') {
        parsedCapacity = parseInt(max_capacity);
        if (isNaN(parsedCapacity) || parsedCapacity < 0)
            throw Object.assign(new Error('Maximum scholar capacity must be a non-negative integer'), { status: 400 });

        parsedFt = parseInt(full_time_max_capacity) || 0;
        parsedPt = parseInt(part_time_max_capacity) || 0;
        if (parsedFt < 0 || parsedPt < 0)
            throw Object.assign(new Error('Full-Time and Part-Time capacities must be non-negative'), { status: 400 });
        if (parsedFt + parsedPt > parsedCapacity)
            throw Object.assign(new Error('Combined Full-Time and Part-Time Capacity cannot exceed Max Capacity'), { status: 400 });
    }

    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await repo.update(type, id, {
        name: name.trim(),
        abbreviation: abbreviation?.trim(),
        max_capacity: parsedCapacity,
        full_time_max_capacity: parsedFt,
        part_time_max_capacity: parsedPt,
        full_time_required:  full_time_required  ? 1 : 0,
        part_time_required:  part_time_required  ? 1 : 0,
        is_active: updatedActive,
    });

    const updated = await repo.findById(type, id);

    if (type === 'designations') {
        const auditFields = [
            ['name',                  existing.name,                  updated.name],
            ['max_capacity',          existing.max_capacity,          updated.max_capacity],
            ['full_time_max_capacity',existing.full_time_max_capacity,updated.full_time_max_capacity],
            ['part_time_max_capacity',existing.part_time_max_capacity,updated.part_time_max_capacity],
            ['full_time_required',    existing.full_time_required,    updated.full_time_required],
            ['part_time_required',    existing.part_time_required,    updated.part_time_required],
            ['is_active',             existing.is_active,             updated.is_active],
        ];
        for (const [field, oldVal, newVal] of auditFields) {
            if (String(oldVal) !== String(newVal)) {
                await repo.logDesignationAudit(id, updated.name, 'UPDATE', field, oldVal, newVal, adminUser);
            }
        }
    }

    return updated;
}

async function toggleActive(type, id, is_active, adminUser) {
    const existing = await repo.findById(type, id);
    if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });

    const newActive = is_active ? 1 : 0;
    await repo.toggleActive(type, id, newActive);

    if (type === 'designations' && existing.is_active !== newActive) {
        await repo.logDesignationAudit(id, existing.name, 'UPDATE', 'is_active', existing.is_active, newActive, adminUser);
    }

    return repo.findById(type, id);
}

async function remove(type, id, adminUser) {
    const existing = await repo.findById(type, id);
    if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });

    const count = await repo.remove(type, id);
    if (!count) throw Object.assign(new Error('Not found'), { status: 404 });

    if (type === 'designations') {
        await repo.logDesignationAudit(
            id, existing.name, 'DELETE', null,
            JSON.stringify({
                name: existing.name,
                max_capacity: existing.max_capacity,
                full_time_max_capacity: existing.full_time_max_capacity,
                part_time_max_capacity: existing.part_time_max_capacity,
                is_active: existing.is_active,
            }),
            null, adminUser
        );
    }
}

module.exports = { list, get, create, update, toggleActive, remove };
