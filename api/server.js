require("dotenv").config(); // Load .env
const connectDB = require("./config/database");
const app = require("./app");
const path = require("path");

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Explicitly configure static file serving (backup to app.js)
    const staticPath = path.join(__dirname, '../static');
    console.log(`Static files served from: ${staticPath}`);
    
    // Start server after DB is ready
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Static files available at: http://localhost:${PORT}/static/`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Start the server
startServer();

