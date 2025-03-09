// src/utils/helpers.js
export function catchAsync(fn) {
  return (...args) => fn(...args).catch((err) => {
    console.error('Async function error:', err);
  });
}
