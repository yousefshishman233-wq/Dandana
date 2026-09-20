const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') return null;
  return 'denden_secret_key_2024';
};

// Authentication middleware
const auth = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token, authorization denied'
      });
    }

    try {
      // Verify token
      const secret = getJwtSecret();
      if (!secret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ success: false, message: 'Authentication is not configured' });
      }
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient permissions'
      });
    }

    next();
  };
};

module.exports = { auth, authorize, getJwtSecret };