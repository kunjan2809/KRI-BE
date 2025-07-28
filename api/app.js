const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimiter = require("./middlewares/rateLimiter");
const cors = require("cors");
// const productRoutes = require("./routes/productRoutes");
// const userRoutes = require("./routes/userRoutes");

const app = express();

// Middleware
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON body
app.use(morgan("dev")); // Logging
app.use(helmet()); // Security headers
app.use(rateLimiter); // Rate limiter

// Routes (uncomment and implement as needed)
// app.use("/api/products", productRoutes);
// app.use("/api/users", userRoutes);

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

module.exports = app;

