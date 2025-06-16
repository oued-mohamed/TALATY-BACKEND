const { getChannel } = require('../config/messageBroker');
const KYCVerification = require('../models/KYCVerification');
const { sendKYCStatusUpdate } = require('./smsService');

const startEventConsumer = async () => {
  try {
    const channel = getChannel();
    
    // Create queue for KYC events
    const queue = await channel.assertQueue('kyc_service_events', { durable: true });
    
    // Bind to relevant events
    await channel.bindQueue(queue.queue, 'user_events', 'user.created');
    await channel.bindQueue(queue.queue, 'user_events', 'user.profile.updated');
    await channel.bindQueue(queue.queue, 'document_events', 'document.status.updated');
    
    // Consume messages
    await channel.consume(queue.queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await handleEvent(message);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing event:', error);
          channel.nack(msg, false, false);
        }
      }
    });
    
    console.log('KYC Service event consumer started');
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
    case 'user.profile.updated':
      await handleUserProfileUpdated(data);
      break;
    case 'document.status.updated':
      await handleDocumentStatusUpdated(data);
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
};

const handleUserCreated = async (data) => {
  try {
    const { userId } = data;
    console.log(`User created event received for KYC: ${userId}`);
    // KYC will be started when user initiates the process
  } catch (error) {
    console.error('Error handling user created event:', error);
  }
};

const handleUserProfileUpdated = async (data) => {
  try {
    const { userId, profileCompletion } = data;
    
    // Check if user has KYC in progress and profile completion affects next steps
    const kycVerification = await KYCVerification.findOne({
      userId,
      status: 'in_progress'
    });
    
    if (kycVerification && profileCompletion >= 60 && kycVerification.currentStep === 'profile_setup') {
      // User can now proceed to document upload
      console.log(`Profile completion updated for KYC: ${userId} - ${profileCompletion}%`);
    }
  } catch (error) {
    console.error('Error handling user profile updated event:', error);
  }
};

const handleDocumentStatusUpdated = async (data) => {
  try {
    const { userId, documentId, type, status } = data;
    
    // Update KYC verification if this document is part of the process
    const kycVerification = await KYCVerification.findOne({
      userId,
      status: { $in: ['pending', 'in_progress'] }
    });
    
    if (kycVerification) {
      // Check if this document is used in identity verification
      if (kycVerification.identityVerification.idDocument?.toString() === documentId ||
          kycVerification.identityVerification.selfie?.toString() === documentId) {
        
        if (status === 'verified') {
          console.log(`Identity document verified for KYC: ${userId}`);
        } else if (status === 'rejected') {
          console.log(`Identity document rejected for KYC: ${userId}`);
          // Could trigger KYC rejection or request for new document
        }
      }
      
      // Handle business documents
      if (type === 'business_registration' && status === 'verified') {
        kycVerification.businessVerification.registrationDocument = documentId;
        kycVerification.businessVerification.verificationStatus = 'verified';
        kycVerification.businessVerification.verifiedAt = new Date();
        await kycVerification.save();
      }
    }
  } catch (error) {
    console.error('Error handling document status updated event:', error);
  }
};

module.exports = { startEventConsumer };