const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/business-ekyc-auth', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`Auth Service MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Auth Service Database connection error:', error);
    throw error;
  }
};

module.exports = { connectDatabase };