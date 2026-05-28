/**
 * Shared JWT authentication middleware.
 *
 * Usage:
 *   const { verifyToken, isAdmin } = require('../../shared/middleware/auth');
 *
 * Each module that uses this must ensure JWT_SECRET env var is set.
 * For multi-module use, pass the correct secret explicitly or set
 * the module-specific env var in your dotenv config.
 */
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(403).json({ success: false, message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Require Admin Role' });
    }
};

const authenticateToken = verifyToken;

module.exports = { verifyToken, authenticateToken, isAdmin };
