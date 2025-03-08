// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // TODO: Validate and authenticate user
    const user = await User.findOne({ email });
    if (!user || password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Sign a token (replace 'secret' with your secret from env)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    // TODO: Validate data
    const user = await User.create({ email, password, name });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
