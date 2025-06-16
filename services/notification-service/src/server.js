const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const notificationRoutes = require('./routes/notification');
const { connectDatabase } = require('./config/database');
const { connectMessageBroker } = require('./config/messageBroker');
const { startEventConsumer } = require('./services/eventConsumer');
const { initializeFirebase } = require('./config/firebase');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'notification-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase();
    await connectMessageBroker();
    await initializeFirebase();
    await startEventConsumer();
    
    const PORT = process.env.PORT || 3006;
    app.listen(PORT, () => {
      console.log(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start notification service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;