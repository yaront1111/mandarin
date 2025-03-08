const { Message } = require('../models');
const { catchAsync } = require('../utils/helpers');

exports.getMessages = catchAsync(async (req, res) => {
  const matchId = req.params.matchId;
  const messages = await Message.findAll({
    where: { matchId },
    order: [['createdAt', 'ASC']]
  });
  res.json({ success: true, data: messages });
});

exports.sendMessage = catchAsync(async (req, res) => {
  const { matchId, content, messageType } = req.body;
  const senderId = req.user.id;

  // Create new message
  const message = await Message.create({
    matchId,
    senderId,
    content,
    messageType: messageType || 'text'
  });

  // Optionally, you can emit a socket event from the controller
  // const io = require('../socket').getIO();
  // io.to(`match:${matchId}`).emit('chat:message', message);

  res.status(201).json({ success: true, data: message });
});
