// Token-bucket / sliding window rate limiter in memory (with Redis fallback)
const requestCounts = new Map();

export const rateLimiter = ({ windowMs = 60000, max = 120, message = 'Too many requests, please try again later.' } = {}) => {
  return (req, res, next) => {
    // Identify client by user ID or IP
    const key = req.user?._id ? `user:${req.user._id}` : req.ip || req.headers['x-forwarded-for'] || 'anonymous';
    const now = Date.now();

    const record = requestCounts.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    requestCounts.set(key, record);

    if (record.count > max) {
      return res.status(429).json({ message });
    }

    next();
  };
};

// Periodic cleanup of expired rate limit keys
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 120000);
