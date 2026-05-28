const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/centreController');
const { verifyToken, isAdmin } = require('../../../admin/backend/middleware/auth');

const uploadDir = path.join(__dirname, '../../../admin/backend/uploads/centres');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|doc|docx/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.originalname}`));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

const centreUpload = upload.fields([
    { name: 'recognition_certificate', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
]);

router.get('/',          verifyToken, isAdmin, ctrl.list);
router.get('/:id',       verifyToken, isAdmin, ctrl.get);
router.post('/',         verifyToken, isAdmin, centreUpload, ctrl.create);
router.put('/:id',       verifyToken, isAdmin, centreUpload, ctrl.update);
router.patch('/:id/status', verifyToken, isAdmin, ctrl.updateStatus);
router.delete('/:id',    verifyToken, isAdmin, ctrl.remove);

module.exports = router;
