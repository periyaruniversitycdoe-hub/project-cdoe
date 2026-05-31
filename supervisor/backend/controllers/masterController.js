const svc = require('../services/masterService');

const wrap = fn => async (req, res) => {
    try { res.json({ success: true, data: await fn(req, res) }); }
    catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
};

const list = wrap(req => svc.list(req.params.type, req.query.active_only === 'true'));
const get  = wrap(req => svc.get(req.params.type, req.params.id));

const create = wrap(req => svc.create(req.params.type, req.body, req.user?.email || 'admin'));
const update = wrap(req => svc.update(req.params.type, req.params.id, req.body, req.user?.email || 'admin'));

const toggleActive = wrap(req => {
    const is_active = req.body.is_active !== undefined ? req.body.is_active : true;
    return svc.toggleActive(req.params.type, req.params.id, is_active, req.user?.email || 'admin');
});

const remove = wrap(async req => {
    await svc.remove(req.params.type, req.params.id, req.user?.email || 'admin');
    return null;
});

module.exports = { list, get, create, update, toggleActive, remove };
