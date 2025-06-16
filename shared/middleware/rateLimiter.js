const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');

// Create Redis client if available
let redisClient;
try {
  redisClient = Redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  });
} catch (error) {
  console.warn('Redis not available, using memory store for rate limiting');
}

const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  };

  // Use Redis store if available
  if (redisClient) {
    defaultOptions.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    });
  }

  return rateLimit(defaultOptions);
};

// Specific rate limiters for different endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
});

const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 uploads per hour
  message: {
    success: false,
    message: 'Too many uploads, please try again later.'
  }
});

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 API requests per windowMs
});

module.exports = {
  createRateLimiter,
  authLimiter,
  uploadLimiter,
  apiLimiter
};