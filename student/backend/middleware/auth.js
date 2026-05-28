'use strict';
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token      = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. Token missing.', 
      errorCode: 'AUTH_TOKEN_MISSING' 
    });
  }

  jwt.verify(token, process.env.STUDENT_JWT_SECRET, (err, user) => {
    if (err) {
      const errorCode = err.name === 'TokenExpiredError' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID';
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token.', 
        errorCode 
      });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'Admin')) return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

module.exports = { authenticateToken, isAdmin };
