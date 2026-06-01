const svc = require('../services/supervisorService');

const wrap = fn => async (req, res) => {
    try { res.json({ success: true, data: await fn(req, res) }); }
    catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
};

const list = wrap(req => svc.list({
    status: req.query.status,
    search: req.query.search,
    page:   parseInt(req.query.page)  || 1,
    limit:  parseInt(req.query.limit) || 20,
}));

const get  = wrap(req => svc.get(req.params.id));

const create = wrap(req => svc.create(req.body, req.files));
const update = wrap(req => svc.update(req.params.id, req.body, req.files));

const updateStatus = wrap(req => svc.updateStatus(req.params.id, { 
    ...req.body, 
    approved_by: req.user.id 
}));

const remove = wrap(async req => {
    await svc.remove(req.params.id);
    return null;
});

const removeAll = wrap(async () => {
    const deleted = await svc.removeAll();
    return { deleted };
});

const getActiveCentres = wrap(() => svc.getActiveCentres());
const listCapacityConfigs = wrap(() => svc.listCapacityConfigs());
const upsertCapacityConfig = wrap(req => svc.upsertCapacityConfig(req.body));
const getCapacityByDesignation = wrap(req => svc.getCapacityByDesignation(req.params.designationId));

module.exports = { list, get, create, update, updateStatus, remove, removeAll, getActiveCentres, listCapacityConfigs, upsertCapacityConfig, getCapacityByDesignation };
