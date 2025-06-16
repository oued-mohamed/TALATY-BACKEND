// services/document-service/src/controllers/documentController.js - UPDATED VERSION
const Document = require('../models/Document');
const { validationResult } = require('express-validator');
const { uploadToStorage, deleteFromStorage } = require('../services/storageService');
const { processDocument } = require('../services/processingService');
const { publishEvent } = require('../services/eventPublisher');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// ✅ UPDATED: Upload document with User model integration
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { type } = req.body;
    const userId = req.headers['x-user-id'];

    // Validate document type
    const validTypes = [
      'national_id', 'nationalId',
      'passport', 
      'driving_license', 
      'business_registration', 'businessRegistration',
      'bank_statement', 'bankStatement',
      'selfie',
      'proof_of_address', 'proofOfAddress'
    ];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // Normalize document type for consistency
    const normalizedType = type.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

    // Process image if it's an image file
    let processedPath = req.file.path;
    let finalSize = req.file.size;

    if (req.file.mimetype.startsWith('image/')) {
      try {
        const processedFilename = `processed_${req.file.filename}`;
        processedPath = path.join(req.file.destination, processedFilename);
        
        const processedImage = await sharp(req.file.path)
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

        await fs.writeFile(processedPath, processedImage);
        finalSize = processedImage.length;

        // Delete original file
        await fs.unlink(req.file.path);
      } catch (error) {
        console.error('Image processing error:', error);
        // Use original file if processing fails
        processedPath = req.file.path;
      }
    }

    // Upload to cloud storage if configured
    let storageUrl = null;
    if (process.env.USE_CLOUD_STORAGE === 'true') {
      try {
        storageUrl = await uploadToStorage(processedPath, `${userId}/${normalizedType}/${req.file.filename}`);
      } catch (error) {
        console.error('Cloud storage upload error:', error);
      }
    }

    // Create document record
    const document = new Document({
      userId,
      type: normalizedType,
      filename: path.basename(processedPath),
      originalName: req.file.originalname,
      path: processedPath,
      url: storageUrl,
      size: finalSize,
      mimeType: req.file.mimetype,
      uploadProgress: 100
    });

    await document.save();

    // ✅ NEW: Update user's document tracking
    try {
      // Call user service to update document status
      const userUpdateResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/users/mark-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-service-name': 'document-service'
        },
        body: JSON.stringify({
          documentType: normalizedType.replace(/_/g, '')  // Convert back to camelCase
        })
      });

      if (!userUpdateResponse.ok) {
        console.warn('Failed to update user document status:', await userUpdateResponse.text());
      }
    } catch (error) {
      console.error('Error updating user document status:', error);
      // Don't fail the document upload if user update fails
    }

    // Publish document uploaded event
    await publishEvent('document.uploaded', {
      userId,
      documentId: document._id,
      type: normalizedType,
      filename: document.filename
    });

    // Start background processing for certain document types
    if (['national_id', 'nationalId', 'passport', 'driving_license', 'business_registration', 'businessRegistration'].includes(type)) {
      processDocument(document._id).catch(error => {
        console.error('Document processing error:', error);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { 
        document: {
          ...document.toObject(),
          // Add file URL for frontend
          fileUrl: storageUrl || `/api/documents/${document._id}/download`,
          thumbnailUrl: storageUrl ? `${storageUrl}?w=300&h=300` : null
        }
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document upload',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ EXISTING: Get user documents (enhanced for admin access)
exports.getUserDocuments = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const requestingUserId = req.headers['x-requesting-user-id'] || userId;
    const serviceName = req.headers['x-service-name'];
    const { type, status, page = 1, limit = 10 } = req.query;

    // Check if this is an admin request
    const isAdminRequest = serviceName === 'user-service' && requestingUserId !== userId;

    let query = { userId };
    if (type) query.type = type;
    if (status) query.verificationStatus = status;

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select(isAdminRequest ? '' : '-extractedData -metadata.extractedText'); // Admin can see all data

    const total = await Document.countDocuments(query);

    // Add file URLs for frontend consumption
    const documentsWithUrls = documents.map(doc => ({
      ...doc.toObject(),
      fileUrl: doc.url || `/api/documents/${doc._id}/download`,
      thumbnailUrl: doc.url ? `${doc.url}?w=300&h=300` : null
    }));

    res.status(200).json({
      success: true,
      data: {
        documents: documentsWithUrls,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching documents'
    });
  }
};

// ✅ EXISTING: Get document by ID (enhanced security)
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const serviceName = req.headers['x-service-name'];

    // Allow admin access from user-service
    const query = serviceName === 'user-service' ? { _id: id } : { _id: id, userId };
    
    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { 
        document: {
          ...document.toObject(),
          fileUrl: document.url || `/api/documents/${document._id}/download`,
          thumbnailUrl: document.url ? `${document.url}?w=300&h=300` : null
        }
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching document'
    });
  }
};

// ✅ UPDATED: Update document verification status (admin only)
exports.updateDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const serviceName = req.headers['x-service-name'];
    const adminUserId = req.headers['x-admin-user-id'];

    // Only allow admin updates
    if (serviceName !== 'user-service') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const validStatuses = ['pending', 'processing', 'verified', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    const document = await Document.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    document.updateVerificationStatus(status, notes);
    if (adminUserId) {
      document.verifiedBy = adminUserId;
      document.verifiedAt = new Date();
    }
    await document.save();

    // Publish status update event
    await publishEvent('document.status.updated', {
      userId: document.userId,
      documentId: document._id,
      type: document.type,
      status,
      notes,
      verifiedBy: adminUserId
    });

    res.status(200).json({
      success: true,
      message: 'Document status updated successfully',
      data: { document }
    });
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during status update'
    });
  }
};

// ✅ EXISTING: Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Delete file from local storage
    try {
      await fs.unlink(document.path);
    } catch (error) {
      console.error('Local file deletion error:', error);
    }

    // Delete from cloud storage if exists
    if (document.url) {
      try {
        await deleteFromStorage(document.url);
      } catch (error) {
        console.error('Cloud storage deletion error:', error);
      }
    }

    // Remove document from database
    await Document.findByIdAndDelete(id);

    // ✅ NEW: Update user's document tracking
    try {
      const userUpdateResponse = await fetch(`${process.env.USER_SERVICE_URL}/api/users/mark-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-service-name': 'document-service'
        },
        body: JSON.stringify({
          documentType: document.type.replace(/_/g, ''),
          uploaded: false  // Mark as not uploaded
        })
      });

      if (!userUpdateResponse.ok) {
        console.warn('Failed to update user document status after deletion');
      }
    } catch (error) {
      console.error('Error updating user document status after deletion:', error);
    }

    // Publish document deleted event
    await publishEvent('document.deleted', {
      userId,
      documentId: document._id,
      type: document.type
    });

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document deletion'
    });
  }
};

// ✅ UPDATED: Download document (with admin access)
exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    const serviceName = req.headers['x-service-name'];

    // Allow admin access
    const query = serviceName === 'user-service' ? { _id: id } : { _id: id, userId };
    const document = await Document.findOne(query);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if file exists locally
    try {
      await fs.access(document.path);
      
      // Set appropriate headers
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      res.setHeader('Content-Length', document.size);
      
      // Send file
      return res.sendFile(path.resolve(document.path));
    } catch (error) {
      // If local file doesn't exist, try cloud storage
      if (document.url) {
        return res.redirect(document.url);
      }
      
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during document download'
    });
  }
};

// ✅ UPDATED: Get document statistics
exports.getDocumentStats = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const serviceName = req.headers['x-service-name'];

    let matchQuery = {};
    
    // If not admin request, filter by userId
    if (serviceName !== 'user-service') {
      matchQuery.userId = mongoose.Types.ObjectId(userId);
    }

    const stats = await Document.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeStats = await Document.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const totalDocuments = await Document.countDocuments(matchQuery);

    // ✅ NEW: Additional stats for admin
    let additionalStats = {};
    if (serviceName === 'user-service') {
      const recentUploads = await Document.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      const avgProcessingTime = await Document.aggregate([
        {
          $match: {
            verificationStatus: { $in: ['verified', 'rejected'] },
            verifiedAt: { $exists: true }
          }
        },
        {
          $project: {
            processingTime: {
              $divide: [
                { $subtract: ['$verifiedAt', '$createdAt'] },
                1000 * 60 * 60 // Convert to hours
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgHours: { $avg: '$processingTime' }
          }
        }
      ]);

      additionalStats = {
        recentUploads,
        avgProcessingTimeHours: avgProcessingTime[0]?.avgHours || 0
      };
    }

    res.status(200).json({
      success: true,
      data: {
        total: totalDocuments,
        byStatus: stats,
        byType: typeStats,
        ...additionalStats
      }
    });
  } catch (error) {
    console.error('Get document stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching document statistics'
    });
  }
};

// ✅ NEW: Batch update document status (admin only)
exports.batchUpdateDocuments = async (req, res) => {
  try {
    const { documentIds, status, notes } = req.body;
    const serviceName = req.headers['x-service-name'];
    const adminUserId = req.headers['x-admin-user-id'];

    if (serviceName !== 'user-service') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const validStatuses = ['pending', 'processing', 'verified', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    const updateData = {
      verificationStatus: status,
      ...(notes && { 'verification.notes': notes }),
      ...(adminUserId && { 
        verifiedBy: adminUserId,
        verifiedAt: new Date()
      })
    };

    const result = await Document.updateMany(
      { _id: { $in: documentIds } },
      { $set: updateData }
    );

    // Publish batch update event
    await publishEvent('documents.batch.updated', {
      documentIds,
      status,
      notes,
      verifiedBy: adminUserId,
      updatedCount: result.modifiedCount
    });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} documents updated successfully`,
      data: { updatedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Batch update documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during batch update'
    });
  }
};

module.exports = {
  uploadDocument: exports.uploadDocument,
  getUserDocuments: exports.getUserDocuments,
  getDocumentById: exports.getDocumentById,
  updateDocumentStatus: exports.updateDocumentStatus,
  deleteDocument: exports.deleteDocument,
  downloadDocument: exports.downloadDocument,
  getDocumentStats: exports.getDocumentStats,
  batchUpdateDocuments: exports.batchUpdateDocuments
};