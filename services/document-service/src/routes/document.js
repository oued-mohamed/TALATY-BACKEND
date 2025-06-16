const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentController = require('../controllers/documentController');

const router = express.Router();

// Ensure upload directories exist
const uploadDirs = ['uploads/documents', 'uploads/selfies'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type } = req.body;
    let uploadPath = 'uploads/documents';
    
    if (type === 'selfie') {
      uploadPath = 'uploads/selfies';
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, PDF, DOC, and DOCX files are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// Routes
router.post('/upload', upload.single('document'), documentController.uploadDocument);
router.get('/', documentController.getUserDocuments);
router.get('/stats', documentController.getDocumentStats);
router.get('/:id', documentController.getDocumentById);
router.put('/:id/status', documentController.updateDocumentStatus);
router.delete('/:id', documentController.deleteDocument);
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;