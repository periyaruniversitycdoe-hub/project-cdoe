const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const controller = require('../controllers/emailTemplate.controller');
const { verifyToken, isAdmin } = require('../../../../middleware/auth');
const { validateTemplate, validatePreviewPayload } = require('../validators/emailTemplate.validator');
const { postUploadCheck } = require('../../../../../../shared/security/fileValidator');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../../uploads/logos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage engine configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize name to prevent directory traversals and XSS
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = path.basename(file.originalname, ext)
            .replace(/[^a-z0-9_-]/gi, '')
            .substring(0, 50);
        cb(null, `logo_${Date.now()}_${safeName}${ext}`);
    }
});

// Strict file type auditor filter
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
        return cb(new Error('Only PNG, JPG, JPEG, and GIF images are allowed'), false);
    }
    
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('File mime type must be an image'), false);
    }
    
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB max logo file size
    }
});

// Mapping Routes
router.get('/categories/all', verifyToken, isAdmin, controller.getCategories);
router.post('/categories/add', verifyToken, isAdmin, controller.addCategory);
router.get('/', verifyToken, isAdmin, controller.getTemplates);
router.get('/:id', verifyToken, isAdmin, controller.getTemplateById);
router.post('/', verifyToken, isAdmin, validateTemplate, controller.createTemplate);
router.put('/:id', verifyToken, isAdmin, validateTemplate, controller.updateTemplate);
router.delete('/:id', verifyToken, isAdmin, controller.deleteTemplate);

// Live preview & Test Send API
router.post('/preview', verifyToken, isAdmin, validatePreviewPayload, controller.renderPreview);
router.post('/send-test', verifyToken, isAdmin, controller.sendTestEmail);

// Branding Logo upload endpoint
router.post('/upload-logo', verifyToken, isAdmin, (req, res, next) => {
    upload.single('logo')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: `Multer upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, postUploadCheck(), controller.uploadLogo);

module.exports = router;
