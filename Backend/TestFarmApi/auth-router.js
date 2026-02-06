const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('./database');
const nodemailer = require('nodemailer');
const { appSettings } = require('./appsettings');

const router = express.Router();

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'testfarm-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30d'; // 30 days

// Email transporter configuration
let emailTransporter = null;
if (appSettings.email && appSettings.email.enabled) {
  emailTransporter = nodemailer.createTransport({
    host: appSettings.email.host,
    port: appSettings.email.port,
    secure: appSettings.email.secure,
    auth: {
      user: appSettings.email.user,
      pass: appSettings.email.password
    }
  });
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [require('sequelize').Op.or]: [{ Username: username }, { Email: email }]
      } 
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if email confirmation is enabled
    const emailEnabled = appSettings.email && appSettings.email.enabled;
    
    // Generate email confirmation token only if email is enabled
    const emailConfirmationToken = emailEnabled ? crypto.randomBytes(32).toString('hex') : null;

    // Create user - automatically confirm email if email system is disabled
    const user = await User.create({
      Username: username,
      Email: email,
      PasswordHash: passwordHash,
      EmailConfirmed: !emailEnabled, // Auto-confirm if email is disabled
      EmailConfirmationToken: emailConfirmationToken,
      CreationTimestamp: new Date()
    });

    // Send confirmation email only if email is enabled
    if (emailEnabled && emailTransporter) {
      const confirmationUrl = `${appSettings.baseUrl || 'http://localhost:4200'}/confirm-email/${emailConfirmationToken}`;
      
      try {
        await emailTransporter.sendMail({
          from: appSettings.email.from || 'noreply@testfarm.local',
          to: email,
          subject: 'Confirm Your Email - TestFarm',
          html: `
            <h2>Welcome to TestFarm!</h2>
            <p>Please confirm your email address by clicking the link below:</p>
            <a href="${confirmationUrl}">Confirm Email</a>
            <p>Or copy and paste this link in your browser:</p>
            <p>${confirmationUrl}</p>
          `
        });
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Continue even if email fails
      }
    }

    res.status(201).json({
      message: emailEnabled ? 'User registered successfully. Please check your email to confirm your account.' : 'User registered successfully. You can now log in.',
      userId: user.Id,
      requiresEmailConfirmation: emailEnabled
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ where: { Username: username } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check if email is confirmed (skip for admin)
    if (!user.EmailConfirmed && username !== 'admin') {
      return res.status(403).json({ error: 'Please confirm your email before logging in' });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.Id, username: user.Username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        emailConfirmed: user.EmailConfirmed
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logout successful' });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User info retrieved
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        emailConfirmed: user.EmailConfirmed,
        creationTimestamp: user.CreationTimestamp
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/confirm-email/{token}:
 *   get:
 *     summary: Confirm user email
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email confirmed
 */
router.get('/confirm-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ where: { EmailConfirmationToken: token } });

    if (!user) {
      return res.status(404).json({ error: 'Invalid confirmation token' });
    }

    if (user.EmailConfirmed) {
      return res.json({ message: 'Email already confirmed' });
    }

    user.EmailConfirmed = true;
    user.EmailConfirmationToken = null;
    await user.save();

    res.json({ message: 'Email confirmed successfully. You can now log in.' });
  } catch (error) {
    console.error('Email confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
