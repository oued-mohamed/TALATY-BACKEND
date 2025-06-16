const cors = require('cors');

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',     // React web app
    'http://localhost:19006',    // Expo web
    'http://localhost:19000',    // Expo DevTools
    'http://192.168.1.100:19000', // Replace with your IP
    'http://10.0.2.2:8080',      // Android emulator
    'exp://localhost:19000',     // Expo mobile
    'exp://192.168.1.100:19000', // Expo mobile with IP
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-user-id',
    'Accept',
    'Origin',
    'X-Requested-With'
  ]
};

module.exports = cors(corsOptions);