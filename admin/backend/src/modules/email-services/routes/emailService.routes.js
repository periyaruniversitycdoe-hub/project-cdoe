const express = require('express');
const router = express.Router();
const controller = require('../controllers/emailService.controller');
const { authenticateToken } = require('../../../../../../shared/middleware/auth');

router.get('/', authenticateToken, controller.getServices);
router.get('/:id', authenticateToken, controller.getService);
router.post('/', authenticateToken, controller.addService);
router.put('/:id', authenticateToken, controller.editService);
router.patch('/:id/status', authenticateToken, controller.toggleStatus);
router.delete('/:id', authenticateToken, controller.removeService);

module.exports = router;
