exports.catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Haversine formula or similar. Just a stub for demonstration.
  return Math.random() * 100; // mock distance
};
