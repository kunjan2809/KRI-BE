require("dotenv").config(); // Load .env
const mongoose = require("mongoose");
const app = require("./app");

const PORT = process.env.PORT || 5000;
const DB_URI = process.env.MONGODB_URI;

// MongoDB connection
mongoose.connect(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("MongoDB connected");
  // Start server after DB is ready
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})
.catch((err) => {
  console.error("MongoDB connection failed:", err.message);
});

