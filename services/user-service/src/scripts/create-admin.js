const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/userservice');
    console.log('Connected to MongoDB');

    // Import User model (adjust path as needed)
    const User = require('../models/User');

    // Admin user details
    const adminData = {
  username: process.env.ADMIN_USERNAME || 'admin',
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'ADmin123456',
  firstName: process.env.ADMIN_FIRSTNAME || 'Admin',
  lastName: process.env.ADMIN_LASTNAME || 'User',
  phone: process.env.ADMIN_PHONE || '+212681172840',
  role: 'admin',
  isVerified: true,
  // Add other fields as needed based on your User schema
};

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: adminData.email },
        { username: adminData.username }
      ]
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const saltRounds = 10;
    adminData.password = await bcrypt.hash(adminData.password, saltRounds);

    // Create admin user
    const admin = new User(adminData);
    await admin.save();

    console.log('Admin user created successfully');
    console.log(`Username: ${adminData.username}`);
    console.log(`Email: ${adminData.email}`);
    console.log('Password: Check your environment variables or use default');

  } catch (error) {
    console.error('Failed to create admin user:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

createAdmin();