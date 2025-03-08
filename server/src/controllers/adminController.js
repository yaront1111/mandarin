const { User } = require('../models');
const { catchAsync } = require('../utils/helpers');

exports.getAllUsers = catchAsync(async (req, res) => {
  // For example, only admin can do this
  if (req.user.role !== 'admin') {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const users = await User.findAll();
  res.json({ success: true, data: users });
});

exports.banUser = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin') {
    const err = new Error('Not authorized');
    err.statusCode = 403;
    throw err;
  }

  const { userId } = req.body;
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  user.accountStatus = 'banned';
  await user.save();

  res.json({ success: true, message: `User ${user.email} banned.` });
});
