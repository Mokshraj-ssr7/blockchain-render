const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Please add a filename'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original file name is required']
  },
  mimeType: {
    type: String,
    required: [true, 'File MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required']
  },
  ipfsHash: {
    type: String,
    required: [true, 'IPFS hash is required']
  },
  blockchainTxHash: {
    type: String,
    required: [true, 'Blockchain transaction hash is required']
  },
  fileHash: {
    type: String,
    required: [true, 'File hash is required for verification']
  },
  passcodeHash: {
    type: String,
    required: [true, 'Passcode hash is required']
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  receiverAddress: {
    type: String,
    required: [true, 'Receiver blockchain address is required']
  },
  isTransferred: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Static method to verify a 6-digit passcode
FileSchema.statics.verifyPasscode = async function(fileId, passcode) {
  const file = await this.findById(fileId);
  if (!file) {
    return false;
  }

  // In a real implementation, we would use bcrypt to compare the hashes
  // For simplicity, we'll just check if the passcode hash matches a simple hash
  const crypto = require('crypto');
  const passHash = crypto
    .createHash('sha256')
    .update(passcode)
    .digest('hex');
  
  return file.passcodeHash === passHash;
};

module.exports = mongoose.model('File', FileSchema); 