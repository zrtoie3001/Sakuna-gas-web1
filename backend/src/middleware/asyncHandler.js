// ครอบ async route handler ให้ error ทุกอย่างไหลไปยัง Express error middleware
// แทนที่จะ crash server
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
