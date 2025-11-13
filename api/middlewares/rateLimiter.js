const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 150, // limit each IP to 60 requests per minute
  message: "Too many requests from this IP, please try again in a minute.",
});

module.exports = limiter;   