const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

/**
 * POST /api/auth/signup
 * Body: { username, password }
 */
exports.signup = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await db.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );

    return res.status(201).json({ message: 'User created successfully.' });
  } catch (err) {
    console.error('Signup Error:', err);
    return res.status(500).json({ error: 'Server error during signup.' });
  }
};

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    // Find user
    const rows = await db.query(
      'SELECT id, password FROM users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Compare passwords
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, username },
      process.env.JWT_SECRET || 'changeme',
      { expiresIn: '1h' }
    );

    return res.json({ message: 'Logged in', token });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};
