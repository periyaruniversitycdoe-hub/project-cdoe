
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

// Accepts either a full access token OR a short-lived MFA setup/challenge token.
// Skips auth entirely for /validate — that route is self-authenticated via
// the mfaToken in the request body (a signed JWT verified inside the route).
const verifyTokenOrSetupToken = (req, res, next) => {
    // /validate carries its own signed mfaToken — no Authorization header needed
    if (req.path === '/validate') return next();

    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) return res.status(403).json({ success: false, message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        // Accept full access tokens AND mfa_challenge tokens (for initial setup)
        req.user = decoded.mfaChallengeFor
            ? { id: decoded.mfaChallengeFor, email: decoded.email, role: 'admin' }
            : decoded;
        return next();
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

module.exports = { verifyToken, verifyTokenOrSetupToken, isAdmin };
