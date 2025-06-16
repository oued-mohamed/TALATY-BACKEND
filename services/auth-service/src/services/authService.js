// src/services/authService.js - VERSION CORRIGÉE
import { apiService } from './api';
import { storageService } from './storageService';

// ✅ CORRIGÉ: Pointez directement vers l'auth-service
const API_BASE_URL = 'http://localhost:3001'; // Port direct de l'auth-service
// Pour un appareil physique, utilisez votre IP locale :
// const API_BASE_URL = 'http://192.168.1.XXX:3001';

class AuthService {
  async login(email, password) {
    try {
      const response = await apiService.auth.login({ email, password });
      
      if (response.success) {
        const { user, token } = response.data;
        
        // Store auth data
        await storageService.setItem('authToken', token);
        await storageService.setItem('userId', user.id.toString());
        await storageService.setItem('userProfile', user);
        
        return { success: true, data: { user, token } };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.message || 'Login failed' 
      };
    }
  }

  async register(userData) {
    try {
      const response = await apiService.auth.register(userData);
      
      if (response.success) {
        const { user, token } = response.data;
        
        // Store auth data
        await storageService.setItem('authToken', token);
        await storageService.setItem('userId', user.id.toString());
        await storageService.setItem('userProfile', user);
        
        return { success: true, data: { user, token } };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        message: error.message || 'Registration failed' 
      };
    }
  }

  // ✅ CORRIGÉ: WhatsApp OTP avec gestion d'erreurs améliorée
  async sendWhatsAppOTP(phoneNumber) {
    try {
      console.log('📱 Sending WhatsApp OTP to:', phoneNumber);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/send-whatsapp-otp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders())
        },
        body: JSON.stringify({ phoneNumber })
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers.get('content-type'));

      // ✅ DÉBOGAGE: Lire la réponse comme texte d'abord
      const responseText = await response.text();
      console.log('📡 Raw response:', responseText);

      // ✅ GESTION D'ERREUR AMÉLIORÉE
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('❌ Response was:', responseText);
        
        // Si la réponse n'est pas JSON mais que le status est OK
        if (response.ok) {
          return {
            success: true,
            message: 'OTP sent successfully',
            note: 'Server response was not JSON but request succeeded'
          };
        } else {
          throw new Error(`Server returned non-JSON response: ${responseText}`);
        }
      }

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ WhatsApp OTP response:', result);
      return result;
      
    } catch (error) {
      console.error('❌ WhatsApp OTP error:', error);
      
      // ✅ ERREUR SPÉCIFIQUE POUR DÉBOGAGE
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Impossible de contacter le serveur. Vérifiez que l\'auth-service est démarré sur le port 3001.');
      }
      
      throw error;
    }
  }

  // ✅ CORRIGÉ: SMS OTP avec mêmes améliorations
  async sendSMSOTP(phoneNumber) {
    try {
      console.log('📱 Sending SMS OTP to:', phoneNumber);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/send-sms-otp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders())
        },
        body: JSON.stringify({ phoneNumber })
      });

      console.log('📡 Response status:', response.status);

      const responseText = await response.text();
      console.log('📡 Raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        if (response.ok) {
          return {
            success: true,
            message: 'OTP sent successfully',
            note: 'Server response was not JSON but request succeeded'
          };
        } else {
          throw new Error(`Server returned non-JSON response: ${responseText}`);
        }
      }

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ SMS OTP response:', result);
      return result;
      
    } catch (error) {
      console.error('❌ SMS OTP error:', error);
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Impossible de contacter le serveur. Vérifiez que l\'auth-service est démarré sur le port 3001.');
      }
      
      throw error;
    }
  }

  // ✅ CORRIGÉ: Verify OTP avec mêmes améliorations
  async verifyOTP(phoneNumber, otp, method = 'sms') {
    try {
      console.log('🔐 Verifying OTP:', { phoneNumber, otp: '***', method });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders())
        },
        body: JSON.stringify({ phoneNumber, otp, method })
      });

      console.log('📡 Verify response status:', response.status);

      const responseText = await response.text();
      console.log('📡 Verify raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        if (response.ok) {
          return {
            success: true,
            message: 'OTP verified successfully'
          };
        } else {
          throw new Error(`Server returned non-JSON response: ${responseText}`);
        }
      }

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ OTP verification response:', result);
      return result;
      
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Impossible de contacter le serveur. Vérifiez que l\'auth-service est démarré.');
      }
      
      throw error;
    }
  }

  // ✅ HELPER: Get auth headers for API calls
  async getAuthHeaders() {
    try {
      const token = await storageService.getItem('authToken');
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch (error) {
      return {};
    }
  }

  async logout() {
    try {
      await apiService.auth.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local cleanup even if API call fails
    }
    
    // Clear local storage
    await storageService.removeItem('authToken');
    await storageService.removeItem('userId');
    await storageService.removeItem('userProfile');
    
    return { success: true };
  }

  async getCurrentUser() {
    try {
      const response = await apiService.auth.getMe();
      
      if (response.success) {
        await storageService.setItem('userProfile', response.data);
        return { success: true, data: response.data };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Get current user error:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to get user data' 
      };
    }
  }

  async isAuthenticated() {
    try {
      const token = await storageService.getItem('authToken');
      return !!token;
    } catch (error) {
      return false;
    }
  }

  async getStoredUser() {
    try {
      const user = await storageService.getItem('userProfile');
      return user;
    } catch (error) {
      return null;
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await apiService.users.updateProfile(profileData);
      
      if (response.success) {
        // Update stored user profile
        const currentUser = await this.getStoredUser();
        const updatedUser = { ...currentUser, ...profileData };
        await storageService.setItem('userProfile', updatedUser);
        
        return { success: true, data: updatedUser };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Update profile error:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to update profile' 
      };
    }
  }
}

export const authService = new AuthService();

// ✅ Export individual OTP functions for easy import
export const sendSMSOTP = (phoneNumber) => authService.sendSMSOTP(phoneNumber);
export const sendWhatsAppOTP = (phoneNumber) => authService.sendWhatsAppOTP(phoneNumber);
export const verifyOTP = (phoneNumber, otp, method) => authService.verifyOTP(phoneNumber, otp, method);

export default authService;