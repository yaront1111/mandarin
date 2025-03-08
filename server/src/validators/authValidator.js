// src/validators/authValidator.js

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

/**
 * Joi schema for user registration
 */
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().required().messages({
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().allow('', null),
  birthDate: Joi.date().iso().required().messages({
    'date.base': 'Birth date must be a valid date',
    'any.required': 'Birth date is required'
  }),
  gender: Joi.string().required().messages({
    'any.required': 'Gender is required'
  }),
  lookingFor: Joi.array().items(Joi.string()).required().messages({
    'any.required': 'Looking for preferences are required'
  })
});

exports.validateRegister = (req, res, next) => {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });

  if (error) {
    // Convert Joi details into a field-based errors object
    const errors = error.details.reduce((acc, curr) => {
      acc[curr.path[0]] = curr.message;
      return acc;
    }, {});
    throw new ValidationError('Validation failed', errors);
  }

  // Replace req.body with the validated data
  req.body = value;
  next();
};
