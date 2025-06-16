const crypto = require('crypto');
const bcrypt = require('bcrypt');

class EncryptionUtil {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
    this.saltRounds = 12;
  }

  // Password hashing
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Data encryption
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const { encrypted, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipher(
      this.algorithm, 
      this.secretKey, 
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Generate secure random tokens
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate OTP
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    
    return otp;
  }

  // Hash sensitive data for comparison
  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate API key
  generateApiKey() {
    return `ak_${this.generateToken(24)}`;
  }
}

module.exports = new EncryptionUtil();