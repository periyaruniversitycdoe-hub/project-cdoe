const repo = require('../repositories/masterRepository');

async function list(type, activeOnly) {
    return repo.findAll(type, activeOnly);
}

async function get(type, id) {
    const item = await repo.findById(type, id);
    if (!item) throw Object.assign(new Error('Not found'), { status: 404 });
    return item;
}

async function create(type, payload) {
    const { name, abbreviation } = payload;
    if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });
    const id = await repo.create(type, { name: name.trim(), abbreviation: abbreviation?.trim() });
    return repo.findById(type, id);
}

async function update(type, id, payload) {
    const { name, abbreviation, is_active } = payload;
    if (!name || !name.trim()) throw Object.assign(new Error('Name is required'), { status: 400 });
    const existing = await repo.findById(type, id);
    if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });
    await repo.update(type, id, { name: name.trim(), abbreviation: abbreviation?.trim(), is_active: is_active ?? existing.is_active });
    return repo.findById(type, id);
}

async function toggleActive(type, id, is_active) {
    const existing = await repo.findById(type, id);
    if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });
    await repo.toggleActive(type, id, is_active ? 1 : 0);
    return repo.findById(type, id);
}

async function remove(type, id) {
    const count = await repo.remove(type, id);
    if (!count) throw Object.assign(new Error('Not found'), { status: 404 });
}

module.exports = { list, get, create, update, toggleActive, remove };
