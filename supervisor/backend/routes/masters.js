const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/masterController');
const { verifyToken, isAdmin } = require('../../../admin/backend/middleware/auth');

// Public: fetch active dropdown values (used by forms)
router.get('/:type',            ctrl.list);
router.get('/:type/:id',        verifyToken, isAdmin, ctrl.get);

// Admin: full CRUD
router.post('/:type',           verifyToken, isAdmin, ctrl.create);
router.put('/:type/:id',        verifyToken, isAdmin, ctrl.update);
router.patch('/:type/:id/toggle', verifyToken, isAdmin, ctrl.toggleActive);
router.delete('/:type/:id',     verifyToken, isAdmin, ctrl.remove);

module.exports = router;
