const { getChannel } = require('../config/messageBroker');
const UserProfile = require('../models/UserProfile');

const startEventConsumer = async () => {
  try {
    const channel = getChannel();
    
    // Create queue for user events
    const queue = await channel.assertQueue('user_service_events', { durable: true });
    
    // Bind to user events
    await channel.bindQueue(queue.queue, 'user_events', 'user.created');
    await channel.bindQueue(queue.queue, 'user_events', 'user.verification.*');
    
    // Consume messages
    await channel.consume(queue.queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await handleEvent(message);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing event:', error);
          channel.nack(msg, false, false); // Don't requeue on error
        }
      }
    });
    
    console.log('User Service event consumer started');
  } catch (error) {
    console.error('Error starting event consumer:', error);
    throw error;
  }
};

const handleEvent = async (message) => {
  const { eventType, data } = message;
  
  switch (eventType) {
    case 'user.created':
      await handleUserCreated(data);
      break;
    case 'user.verification.email':
      await handleEmailVerification(data);
      break;
    case 'user.verification.phone':
      await handlePhoneVerification(data);
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
};

const handleUserCreated = async (data) => {
  try {
    const { userId, email, phone, firstName, lastName } = data;
    
    // Create user profile
    const profile = new UserProfile({
      userId,
      firstName,
      lastName,
      email,
      phone
    });
    
    profile.calculateProfileCompletion();
    await profile.save();
    
    console.log(`User profile created for user: ${userId}`);
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

const handleEmailVerification = async (data) => {
  try {
    const { userId, verified } = data;
    
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: { isEmailVerified: verified } },
      { new: true }
    );
    
    if (profile) {
      profile.calculateProfileCompletion();
      await profile.save();
      console.log(`Email verification updated for user: ${userId}`);
    }
  } catch (error) {
    console.error('Error updating email verification:', error);
    throw error;
  }
};

const handlePhoneVerification = async (data) => {
  try {
    const { userId, verified } = data;
    
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: { isPhoneVerified: verified } },
      { new: true }
    );
    
    if (profile) {
      profile.calculateProfileCompletion();
      await profile.save();
      console.log(`Phone verification updated for user: ${userId}`);
    }
  } catch (error) {
    console.error('Error updating phone verification:', error);
    throw error;
  }
};

module.exports = { startEventConsumer };