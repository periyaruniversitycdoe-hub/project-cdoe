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
    const { name, abbreviation, max_capacity } = payload;
    if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });

    // Prevent duplicate designation names / master names
    const items = await repo.findAll(type, false);
    if (items.some(item => item.name.toLowerCase() === name.trim().toLowerCase())) {
        throw Object.assign(new Error(`Duplicate name not allowed: ${name.trim()}`), { status: 400 });
    }

    let parsedCapacity = 0;
    if (type === 'designations') {
        parsedCapacity = parseInt(max_capacity);
        if (isNaN(parsedCapacity) || parsedCapacity < 0) {
            throw Object.assign(new Error('Maximum scholar capacity must be a non-negative integer'), { status: 400 });
        }
    }

    const id = await repo.create(type, { 
        name: name.trim(), 
        abbreviation: abbreviation?.trim(), 
        max_capacity: parsedCapacity 
    });

    const created = await repo.findById(type, id);

    if (type === 'designations') {
        await repo.logDesignationAudit(
            id,
            created.name,
            'CREATE',
            null,
            null,
            JSON.stringify({ name: created.name, max_capacity: created.max_capacity, is_active: 1 }),
            adminUser
        );
    }

    return created;
}

async function update(type, id, payload, adminUser) {
    const { name, abbreviation, max_capacity, is_active } = payload;
    if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });

    const existing = await repo.findById(type, id);
    if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });

    // Prevent duplicate designation names / master names
    const items = await repo.findAll(type, false);
    if (items.some(item => item.name.toLowerCase() === name.trim().toLowerCase() && item.id !== parseInt(id))) {
        throw Object.assign(new Error(`Duplicate name not allowed: ${name.trim()}`), { status: 400 });
    }

    let parsedCapacity = 0;
    if (type === 'designations') {
        parsedCapacity = parseInt(max_capacity);
        if (isNaN(parsedCapacity) || parsedCapacity < 0) {
            throw Object.assign(new Error('Maximum scholar capacity must be a non-negative integer'), { status: 400 });
        }
    }

    const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await repo.update(type, id, { 
        name: name.trim(), 
        abbreviation: abbreviation?.trim(), 
        max_capacity: parsedCapacity,
        is_active: updatedActive
    });

    const updated = await repo.findById(type, id);

    if (type === 'designations') {
        if (existing.name !== updated.name) {
            await repo.logDesignationAudit(id, updated.name, 'UPDATE', 'name', existing.name, updated.name, adminUser);
        }
        if (existing.max_capacity !== updated.max_capacity) {
            await repo.logDesignationAudit(id, updated.name, 'UPDATE', 'max_capacity', existing.max_capacity, updated.max_capacity, adminUser);
        }
        if (existing.is_active !== updated.is_active) {
            await repo.logDesignationAudit(id, updated.name, 'UPDATE', 'is_active', existing.is_active, updated.is_active, adminUser);
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
            id,
            existing.name,
            'DELETE',
            null,
            JSON.stringify({ name: existing.name, max_capacity: existing.max_capacity, is_active: existing.is_active }),
            null,
            adminUser
        );
    }
}

module.exports = { list, get, create, update, toggleActive, remove };
