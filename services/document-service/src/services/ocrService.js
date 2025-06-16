const sharp = require('sharp');

class OCRService {
  async performOCR(imagePath, documentType) {
    try {
      // Simulate OCR processing delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // In a real implementation, integrate with:
      // - Google Cloud Vision API
      // - AWS Textract
      // - Azure Computer Vision
      // - Tesseract.js

      let extractedData = {};

      switch (documentType) {
        case 'national_id':
          extractedData = await this.extractNationalIdData(imagePath);
          break;
        case 'passport':
          extractedData = await this.extractPassportData(imagePath);
          break;
        case 'driving_license':
          extractedData = await this.extractDrivingLicenseData(imagePath);
          break;
        case 'business_registration':
          extractedData = await this.extractBusinessRegistrationData(imagePath);
          break;
        default:
          extractedData = await this.extractGenericText(imagePath);
      }

      return extractedData;
    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error('Failed to extract text from document');
    }
  }

  async extractNationalIdData(imagePath) {
    // Simulate processing
    await this.enhanceImage(imagePath);

    return {
      documentType: 'Carte Nationale d\'Identité',
      fullName: 'MOUHCINE TEMSAMANI',
      documentNumber: 'K01234567',
      dateOfBirth: '29.11.1988',
      placeOfBirth: 'TANGER ASSILAH - TANGER',
      nationality: 'MAROCAINE',
      expiryDate: '09.09.2029',
      confidence: 0.95,
      quality: 0.92,
      text: 'ROYAUME DU MAROC CARTE NATIONALE D\'IDENTITE MOUHCINE TEMSAMANI K01234567'
    };
  }

  async extractPassportData(imagePath) {
    await this.enhanceImage(imagePath);

    return {
      documentType: 'Passport',
      fullName: 'MOUHCINE TEMSAMANI',
      documentNumber: 'P123456789',
      dateOfBirth: '29.11.1988',
      nationality: 'MAR',
      expiryDate: '29.11.2030',
      confidence: 0.92,
      quality: 0.89,
      text: 'PASSPORT ROYAUME DU MAROC MOROCCO MOUHCINE TEMSAMANI P123456789'
    };
  }

  async extractDrivingLicenseData(imagePath) {
    await this.enhanceImage(imagePath);

    return {
      documentType: 'Permis de Conduire',
      fullName: 'MOUHCINE TEMSAMANI',
      licenseNumber: 'DL123456',
      dateOfBirth: '29.11.1988',
      issueDate: '15.03.2020',
      expiryDate: '15.03.2030',
      confidence: 0.88,
      quality: 0.85,
      text: 'PERMIS DE CONDUIRE MOUHCINE TEMSAMANI DL123456'
    };
  }

  async extractBusinessRegistrationData(imagePath) {
    await this.enhanceImage(imagePath);

    return {
      documentType: 'Registre de Commerce',
      companyName: 'ENTREPRISE TEMSAMANI SARL',
      registrationNumber: 'RC123456',
      registrationDate: '01.01.2020',
      businessSector: 'Commerce et Services',
      confidence: 0.90,
      quality: 0.87,
      text: 'REGISTRE DE COMMERCE ENTREPRISE TEMSAMANI SARL RC123456'
    };
  }

  async extractGenericText(imagePath) {
    await this.enhanceImage(imagePath);

    return {
      documentType: 'Generic Document',
      text: 'Extracted text content from document',
      confidence: 0.75,
      quality: 0.80
    };
  }

  async enhanceImage(imagePath) {
    try {
      // Enhance image quality for better OCR
      const enhancedPath = imagePath.replace('.jpg', '_enhanced.jpg');
      
      await sharp(imagePath)
        .normalize()
        .sharpen()
        .jpeg({ quality: 95 })
        .toFile(enhancedPath);
        
      return enhancedPath;
    } catch (error) {
      console.error('Image enhancement error:', error);
      return imagePath; // Return original if enhancement fails
    }
  }
}

const ocrService = new OCRService();

const performOCR = (imagePath, documentType) => {
  return ocrService.performOCR(imagePath, documentType);
};

module.exports = { performOCR };