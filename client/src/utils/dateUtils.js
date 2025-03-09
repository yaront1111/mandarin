// src/utils/dateUtils.js
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}
