const Document = require('../models/Document');
const { performOCR } = require('./ocrService');
const { publishEvent } = require('./eventPublisher');

const processDocument = async (documentId) => {
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Update status to processing
    document.updateVerificationStatus('processing', 'Starting document processing');
    await document.save();

    // Publish processing started event
    await publishEvent('document.processing.started', {
      userId: document.userId,
      documentId: document._id,
      type: document.type
    });

    let extractedData = {};

    // Perform OCR based on document type
    if (['national_id', 'passport', 'driving_license', 'business_registration'].includes(document.type)) {
      extractedData = await performOCR(document.path, document.type);
      
      // Update document with extracted data
      document.extractedData = extractedData;
      document.metadata = {
        ...document.metadata,
        extractedText: extractedData.text,
        confidence: extractedData.confidence,
        documentQuality: extractedData.quality
      };
    }

    // Perform document authenticity verification
    const authenticityResult = await verifyDocumentAuthenticity(document.path, document.type);
    document.metadata = {
      ...document.metadata,
      securityFeatures: authenticityResult.securityFeatures
    };

    // Determine verification status based on results
    let verificationStatus = 'verified';
    let notes = 'Document processed successfully';

    if (extractedData.confidence < 0.8) {
      verificationStatus = 'rejected';
      notes = 'Low confidence in document authenticity';
    } else if (authenticityResult.score < 0.7) {
      verificationStatus = 'rejected';
      notes = 'Document authenticity verification failed';
    }

    // Update final status
    document.updateVerificationStatus(verificationStatus, notes);
    await document.save();

    // Publish processing completed event
    await publishEvent('document.processing.completed', {
      userId: document.userId,
      documentId: document._id,
      type: document.type,
      status: verificationStatus,
      extractedData: extractedData
    });

    console.log(`Document processing completed for ${documentId}: ${verificationStatus}`);
  } catch (error) {
    console.error('Document processing error:', error);
    
    // Update document status to rejected on error
    try {
      const document = await Document.findById(documentId);
      if (document) {
        document.updateVerificationStatus('rejected', `Processing failed: ${error.message}`);
        await document.save();

        await publishEvent('document.processing.failed', {
          userId: document.userId,
          documentId: document._id,
          type: document.type,
          error: error.message
        });
      }
    } catch (updateError) {
      console.error('Error updating document status after processing failure:', updateError);
    }
  }
};

const verifyDocumentAuthenticity = async (imagePath, documentType) => {
  // Simulate document authenticity verification
  await new Promise(resolve => setTimeout(resolve, 2000));

  const score = Math.random() * 0.3 + 0.7; // Random score between 0.7-1.0

  return {
    score,
    securityFeatures: {
      digitalSignature: score > 0.8,
      watermarks: score > 0.75,
      rfidChip: documentType === 'national_id' && score > 0.85
    }
  };
};

module.exports = { processDocument };