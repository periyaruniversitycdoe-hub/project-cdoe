const express = require('express');
const router = express.Router();
const controller = require('../controllers/email.controller');
const { authenticateToken } = require('../../../../../../shared/middleware/auth');

router.post('/send', authenticateToken, controller.sendEmail);
router.get('/logs', authenticateToken, controller.getLogs);

module.exports = router;
