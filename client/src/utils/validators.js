// src/utils/validators.js
export function isEmailValid(email) {
  return /\S+@\S+\.\S+/.test(email);
}

export function isPasswordStrong(password) {
  return password.length >= 8;
}
