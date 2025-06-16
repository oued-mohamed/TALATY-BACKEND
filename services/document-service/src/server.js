const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const documentRoutes = require('./routes/document');
const { connectDatabase } = require('./config/database');
const { connectMessageBroker } = require('./config/messageBroker');
const { initializeStorage } = require('./config/storage');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/', documentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'document-service',
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
    await initializeStorage();
    
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`Document Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start document service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;