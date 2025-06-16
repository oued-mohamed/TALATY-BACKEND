const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

let s3;

const initializeStorage = async () => {
  if (process.env.USE_CLOUD_STORAGE === 'true') {
    // Configure AWS S3
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    s3 = new AWS.S3();
    console.log('AWS S3 storage initialized');
  } else {
    console.log('Using local storage');
  }
};

const uploadToStorage = async (filePath, key) => {
  if (!s3) {
    throw new Error('Cloud storage not configured');
  }

  try {
    const fileContent = fs.readFileSync(filePath);
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: getMimeType(filePath)
    };

    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
};

const deleteFromStorage = async (key) => {
  if (!s3) {
    return;
  }

  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log(`File deleted from S3: ${key}`);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw error;
  }
};

const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

module.exports = { initializeStorage, uploadToStorage, deleteFromStorage };