// services/auth-service/src/services/otpService.js - VERSION MISE À JOUR
const twilio = require('twilio');
const redis = require('redis');

class OTPService {
  constructor() {
    // Mode test par défaut si pas de configuration
    this.testMode = process.env.TEST_MODE === 'true' || !process.env.TWILIO_ACCOUNT_SID;
    this.memoryStorage = new Map(); // Stockage temporaire pour les tests
    
    console.log(`🔧 OTP Service starting in ${this.testMode ? 'TEST' : 'PRODUCTION'} mode`);
    
    // Initialize Twilio seulement si configuré
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !this.testMode) {
      try {
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.twilioConfigured = true;
        console.log('✅ Twilio configured');
      } catch (error) {
        console.log('⚠️ Twilio configuration failed, using test mode');
        this.testMode = true;
        this.twilioConfigured = false;
      }
    } else {
      console.log('⚠️ Twilio not configured - using test mode');
      this.twilioConfigured = false;
    }
    
    // Initialize Redis seulement si configuré
    if (process.env.REDIS_URL && !this.testMode) {
      try {
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL
        });
        
        this.redisClient.on('error', (err) => {
          console.error('Redis Client Error:', err);
          this.redisConfigured = false;
          console.log('⚠️ Falling back to memory storage');
        });
        
        this.redisClient.on('connect', () => {
          console.log('✅ Redis connected');
          this.redisConfigured = true;
        });
        
        this.connect();
      } catch (error) {
        console.log('⚠️ Redis configuration failed, using memory storage');
        this.redisConfigured = false;
      }
    } else {
      console.log('⚠️ Redis not configured - using memory storage');
      this.redisConfigured = false;
    }
  }

  async connect() {
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
      } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
        this.redisConfigured = false;
      }
    }
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  formatPhoneNumber(phone) {
    if (phone.startsWith('0')) {
      return '+212' + phone.substring(1);
    }
    if (!phone.startsWith('+')) {
      return '+212' + phone;
    }
    return phone;
  }

  async storeOTP(phoneNumber, otp, method) {
    const key = `otp:${phoneNumber}:${method}`;
    const expirySeconds = parseInt(process.env.OTP_EXPIRY_MINUTES || 5) * 60;
    
    try {
      if (this.redisConfigured && this.redisClient) {
        await this.redisClient.setEx(key, expirySeconds, otp);
      } else {
        // Stockage en mémoire avec expiration
        const expiryTime = Date.now() + (expirySeconds * 1000);
        this.memoryStorage.set(key, { otp, expiryTime });
        
        // Nettoyer automatiquement après expiration
        setTimeout(() => {
          this.memoryStorage.delete(key);
        }, expirySeconds * 1000);
      }
      
      console.log(`📱 OTP stored: ${key} = ${otp} (expires in ${expirySeconds}s) [${this.redisConfigured ? 'Redis' : 'Memory'}]`);
    } catch (error) {
      console.error('❌ Error storing OTP:', error);
      // Fallback vers le stockage mémoire
      const expiryTime = Date.now() + (expirySeconds * 1000);
      this.memoryStorage.set(key, { otp, expiryTime });
    }
  }

  async getStoredOTP(phoneNumber, method) {
    const key = `otp:${phoneNumber}:${method}`;
    
    try {
      if (this.redisConfigured && this.redisClient) {
        return await this.redisClient.get(key);
      } else {
        // Récupération depuis la mémoire
        const stored = this.memoryStorage.get(key);
        if (stored) {
          if (Date.now() < stored.expiryTime) {
            return stored.otp;
          } else {
            this.memoryStorage.delete(key);
            return null;
          }
        }
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting stored OTP:', error);
      return null;
    }
  }

  async deleteStoredOTP(phoneNumber, method) {
    const key = `otp:${phoneNumber}:${method}`;
    
    try {
      if (this.redisConfigured && this.redisClient) {
        await this.redisClient.del(key);
      } else {
        this.memoryStorage.delete(key);
      }
    } catch (error) {
      console.error('❌ Error deleting OTP:', error);
    }
  }

  async verifyOTP(phoneNumber, otp, method) {
    try {
      const storedOTP = await this.getStoredOTP(phoneNumber, method);
      
      console.log(`🔐 Verifying OTP: ${otp} vs stored: ${storedOTP} for ${phoneNumber}:${method}`);
      
      if (storedOTP === otp) {
        await this.deleteStoredOTP(phoneNumber, method);
        console.log('✅ OTP verification successful');
        return true;
      }
      
      console.log('❌ OTP verification failed');
      return false;
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      return false;
    }
  }

  async sendSMSOTP(phoneNumber) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const otp = this.generateOTP();
      
      console.log(`📱 Sending SMS OTP to: ${formattedPhone}`);
      
      if (this.twilioConfigured && !this.testMode) {
        // Envoyer via Twilio en production
        const message = await this.twilioClient.messages.create({
          body: `Votre code de vérification BusinessEKYC est: ${otp}. Ce code expire dans ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        });

        await this.storeOTP(phoneNumber, otp, 'sms');
        
        return {
          success: true,
          messageId: message.sid,
          message: 'SMS OTP sent successfully'
        };
      } else {
        // Mode test - juste stocker l'OTP
        console.log(`🧪 TEST MODE - SMS OTP: ${otp} for ${formattedPhone}`);
        await this.storeOTP(phoneNumber, otp, 'sms');
        
        return {
          success: true,
          messageId: 'test-sms-' + Date.now(),
          message: 'SMS OTP sent successfully (test mode)',
          testOTP: otp, // Retourner l'OTP en mode test
          note: 'This is test mode. Use the provided OTP to verify.'
        };
      }
    } catch (error) {
      console.error('❌ SMS OTP Error:', error);
      throw error;
    }
  }

  async sendWhatsAppOTP(phoneNumber) {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const otp = this.generateOTP();
      
      console.log(`📱 Sending WhatsApp OTP to: ${formattedPhone}`);
      
      if (this.twilioConfigured && !this.testMode && process.env.TWILIO_WHATSAPP_NUMBER) {
        // Envoyer via Twilio WhatsApp en production
        const message = await this.twilioClient.messages.create({
          body: `🔐 Votre code de vérification BusinessEKYC est: *${otp}*\n\nCe code expire dans ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.\n\n_Ne partagez pas ce code._`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${formattedPhone}`
        });

        await this.storeOTP(phoneNumber, otp, 'whatsapp');
        
        return {
          success: true,
          messageId: message.sid,
          message: 'WhatsApp OTP sent successfully'
        };
      } else {
        // Mode test - juste stocker l'OTP
        console.log(`🧪 TEST MODE - WhatsApp OTP: ${otp} for ${formattedPhone}`);
        await this.storeOTP(phoneNumber, otp, 'whatsapp');
        
        return {
          success: true,
          messageId: 'test-whatsapp-' + Date.now(),
          message: 'WhatsApp OTP sent successfully (test mode)',
          testOTP: otp, // Retourner l'OTP en mode test
          note: 'This is test mode. Use the provided OTP to verify.'
        };
      }
    } catch (error) {
      console.error('❌ WhatsApp OTP Error:', error);
      throw error;
    }
  }
}

module.exports = new OTPService();