const { getChannel } = require('../config/messageBroker');
const Notification = require('../models/Notification');
const { emailService } = require('./emailService');
const { smsService } = require('./smsService');
const axios = require('axios');

const startEventConsumer = async () => {
  try {
    const channel = getChannel();
    
    // Create queue for notification events
    const queue = await channel.assertQueue('notification_service_events', { durable: true });
    
    // Bind to all relevant events
    await channel.bindQueue(queue.queue, 'user_events', 'user.*');
    await channel.bindQueue(queue.queue, 'kyc_events', 'kyc.*');
    await channel.bindQueue(queue.queue, 'document_events', 'document.*');
    await channel.bindQueue(queue.queue, 'application_events', 'application.*');
    
    // Consume messages
    await channel.consume(queue.queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await handleEvent(message);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing notification event:', error);
          channel.nack(msg, false, false);
        }
      }
    });
    
    console.log('Notification Service event consumer started');
  } catch (error) {
    console.error('Error starting notification event consumer:', error);
    throw error;
  }
};

const handleEvent = async (message) => {
  const { eventType, data } = message;
  
  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'kyc.started':
        await handleKYCStarted(data);
        break;
      case 'kyc.step.completed':
        await handleKYCStepCompleted(data);
        break;
      case 'kyc.completed':
        await handleKYCCompleted(data);
        break;
      case 'document.uploaded':
        await handleDocumentUploaded(data);
        break;
      case 'document.status.updated':
        await handleDocumentStatusUpdated(data);
        break;
      case 'application.created':
        await handleApplicationCreated(data);
        break;
      case 'application.submitted':
        await handleApplicationSubmitted(data);
        break;
      case 'application.decision':
        await handleApplicationDecision(data);
        break;
      default:
        console.log(`Unhandled notification event type: ${eventType}`);
    }
  } catch (error) {
    console.error(`Error handling event ${eventType}:`, error);
  }
};

const handleUserCreated = async (data) => {
  const { userId, email, firstName } = data;
  
  // Send welcome email
  await createNotification({
    userId,
    type: 'email',
    category: 'system',
    title: 'Bienvenue chez Business eKYC',
    message: `Bonjour ${firstName}, bienvenue sur notre plateforme. Commencez par compléter votre profil pour accéder à nos services.`,
    recipient: { email },
    priority: 'normal'
  });

  // Send in-app notification
  await createNotification({
    userId,
    type: 'in_app',
    category: 'system',
    title: 'Compte créé avec succès',
    message: 'Votre compte a été créé. Complétez votre profil pour commencer.',
    priority: 'normal'
  });
};

const handleKYCStarted = async (data) => {
  const { userId, kycId } = data;
  
  const userInfo = await getUserInfo(userId);
  
  await createNotification({
    userId,
    type: 'in_app',
    category: 'kyc',
    title: 'Processus KYC démarré',
    message: 'Votre processus de vérification d\'identité a commencé. Suivez les étapes pour le compléter.',
    data: { kycId },
    priority: 'normal'
  });
};

const handleKYCStepCompleted = async (data) => {
  const { userId, step, progress } = data;
  
  const stepNames = {
    'profile_setup': 'Configuration du profil',
    'document_upload': 'Téléchargement des documents',
    'identity_verification': 'Vérification d\'identité',
    'phone_verification': 'Vérification du téléphone',
    'final_review': 'Révision finale'
  };

  await createNotification({
    userId,
    type: 'in_app',
    category: 'kyc',
    title: 'Étape KYC complétée',
    message: `${stepNames[step]} terminée. Progression: ${progress}%`,
    data: { step, progress },
    priority: 'normal'
  });
};

const handleKYCCompleted = async (data) => {
  const { userId, score, recommendation } = data;
  
  const userInfo = await getUserInfo(userId);
  
  // Send email notification
  if (userInfo && userInfo.email) {
    await emailService.sendKYCStatusEmail(
      userInfo.email, 
      'completed', 
      userInfo.firstName
    );
  }

  // Send SMS notification
  if (userInfo && userInfo.phone) {
    await createNotification({
      userId,
      type: 'sms',
      category: 'kyc',
      title: 'KYC Terminé',
      message: 'Votre vérification d\'identité est terminée avec succès. Vous pouvez maintenant faire une demande de crédit.',
      recipient: { phone: userInfo.phone },
      priority: 'high'
    });
  }

  // Send in-app notification
  await createNotification({
    userId,
    type: 'in_app',
    category: 'kyc',
    title: 'Vérification KYC terminée',
    message: `Félicitations! Votre vérification d'identité est complète. Score: ${score}`,
    data: { score, recommendation },
    priority: 'high'
  });
};

const handleDocumentUploaded = async (data) => {
  const { userId, documentId, type } = data;
  
  const documentNames = {
    'national_id': 'Carte d\'identité nationale',
    'passport': 'Passeport',
    'driving_license': 'Permis de conduire',
    'business_registration': 'Registre de commerce',
    'bank_statement': 'Relevé bancaire',
    'selfie': 'Photo selfie'
  };

  await createNotification({
    userId,
    type: 'in_app',
    category: 'document',
    title: 'Document téléchargé',
    message: `${documentNames[type]} téléchargé avec succès et en cours de vérification.`,
    data: { documentId, type },
    priority: 'normal'
  });
};

const handleDocumentStatusUpdated = async (data) => {
  const { userId, documentId, type, status } = data;
  
  const statusMessages = {
    'verified': 'vérifié avec succès',
    'rejected': 'nécessite votre attention'
  };

  if (status === 'verified' || status === 'rejected') {
    await createNotification({
      userId,
      type: 'in_app',
      category: 'document',
      title: 'Statut du document mis à jour',
      message: `Votre document a été ${statusMessages[status]}.`,
      data: { documentId, type, status },
      priority: status === 'rejected' ? 'high' : 'normal'
    });
  }
};

const handleApplicationCreated = async (data) => {
  const { userId, applicationId, applicationNumber } = data;
  
  await createNotification({
    userId,
    type: 'in_app',
    category: 'application',
    title: 'Demande de crédit créée',
    message: `Votre demande de crédit ${applicationNumber} a été créée. Complétez les étapes pour la soumettre.`,
    data: { applicationId, applicationNumber },
    priority: 'normal'
  });
};

const handleApplicationSubmitted = async (data) => {
  const { userId, applicationId, score, recommendation } = data;
  
  const userInfo = await getUserInfo(userId);
  
  // Send email notification
  if (userInfo && userInfo.email) {
    await emailService.sendApplicationStatusEmail(
      userInfo.email,
      'submitted',
      data.applicationNumber,
      userInfo.firstName
    );
  }

  // Send in-app notification
  await createNotification({
    userId,
    type: 'in_app',
    category: 'application',
    title: 'Demande soumise avec succès',
    message: `Votre demande de crédit a été soumise et est en cours d'examen. Score: ${score}`,
    data: { applicationId, score, recommendation },
    priority: 'high'
  });
};

const handleApplicationDecision = async (data) => {
  const { userId, applicationId, applicationNumber, decision } = data;
  
  const userInfo = await getUserInfo(userId);
  
  // Send email notification
  if (userInfo && userInfo.email) {
    await emailService.sendApplicationStatusEmail(
      userInfo.email,
      decision.outcome,
      applicationNumber,
      userInfo.firstName
    );
  }

  // Send SMS for important decisions
  if (userInfo && userInfo.phone && decision.outcome !== 'pending') {
    const smsMessage = decision.outcome === 'approved' 
      ? 'Excellente nouvelle! Votre demande de crédit a été approuvée.'
      : 'Votre demande de crédit nécessite une révision. Consultez votre compte pour plus de détails.';

    await createNotification({
      userId,
      type: 'sms',
      category: 'application',
      title: 'Décision de crédit',
      message: smsMessage,
      recipient: { phone: userInfo.phone },
      priority: 'urgent'
    });
  }

  // Send in-app notification
  const decisionMessages = {
    'approved': 'Félicitations! Votre demande de crédit a été approuvée.',
    'rejected': 'Votre demande de crédit n\'a pas pu être approuvée à ce moment.',
    'pending': 'Votre demande de crédit nécessite une révision supplémentaire.'
  };

  await createNotification({
    userId,
    type: 'in_app',
    category: 'application',
    title: 'Décision de crédit',
    message: decisionMessages[decision.outcome],
    data: { applicationId, applicationNumber, decision },
    priority: 'urgent'
  });
};

// Helper functions
const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    
    // Process immediately if not scheduled
    if (!notificationData.scheduledAt || new Date(notificationData.scheduledAt) <= new Date()) {
      await processNotification(notification);
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

const processNotification = async (notification) => {
  // Implementation moved to controller for reuse
  const controller = require('../controllers/notificationController');
  return controller.processNotification(notification);
};

const getUserInfo = async (userId) => {
  try {
    const response = await axios.get(`${process.env.USER_SERVICE_URL}/profile`, {
      headers: { 'x-user-id': userId }
    });
    return response.data.data.profile;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
};

module.exports = { startEventConsumer };