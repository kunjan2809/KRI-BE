const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimiter = require("./middlewares/rateLimiter");
const cors = require("cors");
const path = require("path");
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const productRoutes = require("./routes/productRoutes");
const imageRoutes = require("./routes/imageRoutes");
const userRoutes = require("./routes/userRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

const app = express();

// Middleware
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON body
app.use(morgan("dev")); // Logging
app.use(helmet()); // Security headers
app.use(rateLimiter); // Rate limiter

// Static file serving for images
const staticPath = path.join(__dirname, '../static');
console.log('Static files path:', staticPath);
app.use('/static', express.static(staticPath));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'E-Commerce Authentication API Documentation'
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/category", categoryRoutes);

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

module.exports = app;

