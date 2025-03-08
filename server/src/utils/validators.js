// If you want advanced validation, you could integrate "express-validator" or "yup".

exports.validateRegistration = (req, res, next) => {
  const { email, password, birthDate } = req.body;
  if (!email || !password || !birthDate) {
    const err = new Error('Missing required fields');
    err.statusCode = 400;
    return next(err);
  }
  next();
};
