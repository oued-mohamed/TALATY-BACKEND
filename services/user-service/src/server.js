const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { connectDatabase } = require('./config/database');
const { connectMessageBroker } = require('./config/messageBroker');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'auth-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(errorHandler);

// Database and message broker connections
const startServer = async () => {
  try {
    await connectDatabase();
    await connectMessageBroker();
    
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start auth service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;