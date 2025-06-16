const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/userservice');
    console.log('Connected to MongoDB');

    // Add your migration logic here
    // Example: Create indexes, update existing data, etc.
    
    // Example migration: Ensure indexes exist
    const User = require('../models/User'); // Adjust path as needed
    
    // Create indexes if they don't exist
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });
    
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

migrate();