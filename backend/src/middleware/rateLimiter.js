import rateLimit from 'express-rate-limit';

/**
 * 6.3 Scan rate limiter: 5 requests per minute per student user ID.
 * Falls back to client IP if user ID is missing.
 */
export const scanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Limit each student to 5 scans per minute
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    return req.user?.id || req.ip || 'anonymous';
  },
  handler: (req, res) => {
    return res.status(429).json({
      error: 'Scan rate limit exceeded (maximum 5 scans per minute). Please wait a moment before trying again.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});
