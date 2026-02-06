const jwt = require('jsonwebtoken');
const { User } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'testfarm-secret-key-change-in-production';

// Middleware to verify JWT token from cookie
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.Id,
      username: user.Username,
      email: user.Email
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.auth_token;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.userId);

      if (user) {
        req.user = {
          id: user.Id,
          username: user.Username,
          email: user.Email
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};
