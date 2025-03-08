const authService = require('../services/authService');
const { catchAsync } = require('../utils/helpers');

exports.register = catchAsync(async (req, res) => {
  const { email, password, firstName, lastName, birthDate, gender, lookingFor } = req.body;
  const data = await authService.registerUser({ email, password, firstName, lastName, birthDate, gender, lookingFor });
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data
  });
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const response = await authService.loginUser(email, password);
  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: response
  });
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const tokens = await authService.refreshToken(refreshToken);
  res.status(200).json({ success: true, data: tokens });
});

exports.getCurrentUser = catchAsync(async (req, res) => {
  const user = req.user; // from auth middleware
  res.status(200).json({
    success: true,
    data: user
  });
});

exports.logout = catchAsync(async (req, res) => {
  const userId = req.user.id;
  await authService.logoutUser(userId);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});
