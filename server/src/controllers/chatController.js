const { Message } = require('../models');
const { catchAsync } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get messages for a given match.
 * @route GET /api/chat/:matchId
 */
exports.getMessages = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  logger.info(`Fetching messages for match ${matchId}`);
  const messages = await Message.findAll({
    where: { matchId },
    order: [['createdAt', 'ASC']]
  });
  res.status(200).json({ success: true, data: messages });
});

/**
 * Send a new message.
 * @route POST /api/chat
 */
exports.sendMessage = catchAsync(async (req, res) => {
  const { matchId, content, messageType } = req.body;
  const senderId = req.user.id;
  logger.info(`User ${senderId} sending message in match ${matchId}`);

  // Create new message; you might also add validations here
  const message = await Message.create({
    matchId,
    senderId,
    content,
    messageType: messageType || 'text'
  });

  // Optionally, emit a socket event (if socket.io is implemented)
  // const io = require('../socket').getIO();
  // io.to(`match:${matchId}`).emit('chat:message', message);

  res.status(201).json({ success: true, data: message });
});
