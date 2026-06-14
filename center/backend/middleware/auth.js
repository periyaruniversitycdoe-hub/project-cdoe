const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const JWT_SECRET = process.env.CENTER_JWT_SECRET || 'centerSecretKey2026!@#';

function verifyToken(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ message: 'No token provided' });
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '36500d' });
}

module.exports = { verifyToken, signToken };
