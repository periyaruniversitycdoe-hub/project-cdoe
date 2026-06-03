/**
 * File Validator — Layer 7 Security
 * Validates uploaded files by reading their magic bytes (file signature),
 * not just trusting the declared MIME type or file extension.
 *
 * Supported safe types: PDF, JPEG, PNG, GIF, WEBP, DOCX, DOC
 * Everything else is rejected.
 */
const fs     = require('fs');
const crypto = require('crypto');

// Magic byte signatures for allowed file types
// Each entry: { mime, ext[], magic: Buffer | Buffer[] (leading bytes) }
const SIGNATURES = [
    {
        mime:  'application/pdf',
        exts:  ['.pdf'],
        magic: [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
    },
    {
        mime:  'image/jpeg',
        exts:  ['.jpg', '.jpeg'],
        magic: [
            Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
            Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]),
            Buffer.from([0xFF, 0xD8, 0xFF, 0xDB]),
        ],
    },
    {
        mime:  'image/png',
        exts:  ['.png'],
        magic: [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
    },
    {
        mime:  'image/gif',
        exts:  ['.gif'],
        magic: [
            Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
            Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
        ],
    },
    {
        mime:  'image/webp',
        exts:  ['.webp'],
        magic: [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF (first 4 bytes; WEBP at 8-11)
    },
    {
        // DOCX, XLSX, PPTX are ZIP-based (PK header)
        mime:  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        exts:  ['.docx'],
        magic: [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // PK ZIP
    },
    {
        // Legacy DOC (Compound Document)
        mime:  'application/msword',
        exts:  ['.doc'],
        magic: [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
    },
    {
        // XLSX (Office Open XML — ZIP-based, same PK header as DOCX)
        mime:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        exts:  ['.xlsx'],
        magic: [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // PK ZIP
    },
    {
        // XLS (Compound Document — same OLE2 header as DOC)
        mime:  'application/vnd.ms-excel',
        exts:  ['.xls'],
        magic: [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])],
    },
];

const READ_BYTES = 12; // read only the first 12 bytes for signature check

/**
 * Read the first N bytes of a file.
 */
function readHeader(filePath) {
    return new Promise((resolve, reject) => {
        const fd  = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(READ_BYTES);
        fs.read(fd, buf, 0, READ_BYTES, 0, (err, bytesRead) => {
            fs.closeSync(fd);
            if (err) reject(err);
            else resolve(buf.slice(0, bytesRead));
        });
    });
}

/**
 * Check if header starts with any of the magic bytes.
 */
function matchesMagic(header, magics) {
    return magics.some(magic => header.slice(0, magic.length).equals(magic));
}

/**
 * Core magic-byte check on a header Buffer.
 * Used by both disk-storage and memory-storage validators.
 */
function checkHeader(header, ext) {
    for (const sig of SIGNATURES) {
        if (matchesMagic(header, sig.magic)) {
            if (!sig.exts.includes(ext)) {
                return {
                    valid:        false,
                    detectedType: sig.mime,
                    reason:       `Extension mismatch: declared ${ext}, actual content is ${sig.mime}`,
                };
            }
            return { valid: true, detectedType: sig.mime, reason: null };
        }
    }
    return { valid: false, detectedType: null, reason: `Unsupported or unrecognized file type (extension: ${ext})` };
}

/**
 * Validate a file by magic number (disk storage — reads from filePath).
 * @param {string} filePath     - Full path of the uploaded temp file
 * @param {string} originalName - Original filename with extension
 * @returns {{ valid: boolean, detectedType: string|null, reason: string|null }}
 */
async function validateFile(filePath, originalName) {
    const ext = require('path').extname(originalName).toLowerCase();

    const allExts = originalName.split('.').slice(1);
    if (allExts.length > 2) {
        return { valid: false, detectedType: null, reason: 'Double extension detected' };
    }

    let header;
    try {
        header = await readHeader(filePath);
    } catch (err) {
        return { valid: false, detectedType: null, reason: 'Cannot read file header' };
    }

    return checkHeader(header, ext);
}

/**
 * Validate a file by magic number (memory storage — reads from Buffer).
 * @param {Buffer} buffer       - File contents already in memory
 * @param {string} originalName - Original filename with extension
 * @returns {{ valid: boolean, detectedType: string|null, reason: string|null }}
 */
function validateBuffer(buffer, originalName) {
    const ext = require('path').extname(originalName).toLowerCase();

    const allExts = originalName.split('.').slice(1);
    if (allExts.length > 2) {
        return { valid: false, detectedType: null, reason: 'Double extension detected' };
    }

    if (!buffer || buffer.length < 4) {
        return { valid: false, detectedType: null, reason: 'File is empty or too small' };
    }

    return checkHeader(buffer.slice(0, READ_BYTES), ext);
}

/**
 * Multer fileFilter replacement that calls validateFile on the temp disk file.
 * Use AFTER multer has written to disk (use multer's DiskStorage, not MemoryStorage).
 *
 * @param {string[]} allowedExts - e.g. ['.pdf', '.jpg', '.png']
 * @returns multer fileFilter function
 */
function multerFileFilter(allowedExts) {
    return (_req, file, cb) => {
        const ext = require('path').extname(file.originalname).toLowerCase();
        if (!allowedExts.includes(ext)) {
            return cb(new Error(`File type not allowed: ${ext}`), false);
        }
        cb(null, true);
    };
}

/**
 * Post-upload validation middleware.
 * Call after multer processes the upload to validate magic numbers.
 * Deletes the file and returns 400 if validation fails.
 *
 * @param {string[]} [skipExts]  Extensions to skip magic-byte check (e.g. ['.csv'] — text files have no magic)
 *
 * Usage:
 *   app.post('/upload', upload.single('file'), fileValidator.postUploadCheck(), handler)
 *   app.post('/import', upload.single('file'), fileValidator.postUploadCheck(['.csv']), handler)
 */
function postUploadCheck(skipExts = []) {
    const skip = skipExts.map(e => e.toLowerCase());
    return async (req, res, next) => {
        const files = req.files
            ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
            : (req.file ? [req.file] : []);

        for (const f of files) {
            const ext = require('path').extname(f.originalname).toLowerCase();
            if (skip.includes(ext)) continue; // text-only formats (CSV) have no magic bytes

            const result = await validateFile(f.path, f.originalname);
            if (!result.valid) {
                try { fs.unlinkSync(f.path); } catch (_) {}
                return res.status(400).json({
                    success: false,
                    message: `File rejected: ${result.reason || 'Invalid file type'}`,
                });
            }
        }
        next();
    };
}

/**
 * Generate a secure, one-time download token stored in the DB.
 * Token expires in 5 minutes and is single-use.
 *
 * @param {object} db
 * @param {number} userId
 * @param {string} filePath
 * @param {string} portal
 * @returns {string} rawToken  - pass to client as query param
 */
async function generateDownloadToken(db, userId, filePath, portal) {
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.query(
        `INSERT INTO secure_download_tokens (token, user_id, file_path, portal, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [rawToken, userId, filePath, portal, expiresAt]
    );
    return rawToken;
}

/**
 * Validate and consume a download token.
 * @returns {{ valid: boolean, filePath: string|null, reason: string|null }}
 */
async function consumeDownloadToken(db, rawToken, userId, portal) {
    const [[row]] = await db.query(
        `SELECT * FROM secure_download_tokens
          WHERE token = ? AND portal = ? AND used = 0`,
        [rawToken, portal]
    );

    if (!row) return { valid: false, filePath: null, reason: 'Token not found or already used' };
    if (new Date(row.expires_at) < new Date()) {
        return { valid: false, filePath: null, reason: 'Download token expired' };
    }
    if (row.user_id !== userId) {
        return { valid: false, filePath: null, reason: 'Token ownership mismatch' };
    }

    // Mark as used (one-time)
    await db.query(
        `UPDATE secure_download_tokens SET used = 1, used_at = NOW() WHERE token = ?`,
        [rawToken]
    );

    return { valid: true, filePath: row.file_path, reason: null };
}

/**
 * Post-upload validation middleware for multer memoryStorage routes.
 * Reads magic bytes from f.buffer instead of f.path.
 *
 * @param {string[]} [skipExts]  Extensions to skip (e.g. ['.csv'])
 */
function postUploadCheckMemory(skipExts = []) {
    const skip = skipExts.map(e => e.toLowerCase());
    return (req, res, next) => {
        const files = req.files
            ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
            : (req.file ? [req.file] : []);

        for (const f of files) {
            const ext = require('path').extname(f.originalname).toLowerCase();
            if (skip.includes(ext)) continue;

            const result = validateBuffer(f.buffer, f.originalname);
            if (!result.valid) {
                return res.status(400).json({
                    success: false,
                    message: `File rejected: ${result.reason || 'Invalid file type'}`,
                });
            }
        }
        next();
    };
}

module.exports = {
    validateFile,
    validateBuffer,
    multerFileFilter,
    postUploadCheck,
    postUploadCheckMemory,
    generateDownloadToken,
    consumeDownloadToken,
};
