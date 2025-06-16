const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    this.initialize();
  }

  initialize() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      console.log('Twilio SMS service initialized');
    } else {
      console.log('SMS service running in simulation mode');
    }
  }

  async sendSMS(phoneNumber, message) {
    try {
      if (this.client && process.env.NODE_ENV === 'production') {
        const result = await this.client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });

        return {
          success: true,
          messageId: result.sid,
          status: result.status
        };
      } else {
        // Simulation mode for development
        console.log(`SMS Simulation - To: ${phoneNumber}, Message: ${message}`);
        
        return {
          success: true,
          messageId: `sim_${Date.now()}`,
          status: 'delivered',
          simulated: true
        };
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async sendVerificationCode(phoneNumber, code) {
    const message = `Votre code de vérification eKYC est: ${code}. Ce code expire dans 10 minutes.`;
    return this.sendSMS(phoneNumber, message);
  }

  async sendKYCStatusUpdate(phoneNumber, status) {
    let message;
    
    switch (status) {
      case 'completed':
        message = 'Félicitations! Votre vérification eKYC est terminée avec succès.';
        break;
      case 'rejected':
        message = 'Votre vérification eKYC n\'a pas pu être completée. Veuillez contacter le support.';
        break;
      default:
        message = `Votre statut de vérification eKYC a été mis à jour: ${status}`;
    }

    return this.sendSMS(phoneNumber, message);
  }
}

const smsService = new SMSService();

const sendSMS = (phoneNumber, message) => {
  return smsService.sendSMS(phoneNumber, message);
};

const sendVerificationCode = (phoneNumber, code) => {
  return smsService.sendVerificationCode(phoneNumber, code);
};

const sendKYCStatusUpdate = (phoneNumber, status) => {
  return smsService.sendKYCStatusUpdate(phoneNumber, status);
};

module.exports = {
  sendSMS,
  sendVerificationCode,
  sendKYCStatusUpdate
  };

module.exports = {
  sendSMS,
  sendVerificationCode,
  sendKYCStatusUpdate
};