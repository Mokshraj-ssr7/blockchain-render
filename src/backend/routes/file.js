const express = require('express');
const router = express.Router();
const multer = require('multer');
const File = require('../models/file');
const User = require('../models/user');
const encryption = require('../utils/encryption');
const blockchain = require('../utils/blockchain');
const ipfsUtil = require('../utils/ipfs');
const passcodeUtil = require('../utils/passcode');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Middleware to check authentication
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
  }
};

// Upload a file with passcode protection
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const { passcode, receiverAddress } = req.body;
    if (!passcode || !passcodeUtil.validatePasscodeFormat(passcode)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit passcode'
      });
    }

    if (!receiverAddress) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a receiver address'
      });
    }

    const passcodeHash = passcodeUtil.hashPasscode(passcode);
    const { encryptedBuffer, success } = encryption.encryptFile(req.file.buffer, passcode);
    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to encrypt file'
      });
    }

    const fileHash = encryption.hashFile(req.file.buffer);
    const ipfsResult = await ipfsUtil.storeFileOnIpfs(encryptedBuffer);
    if (!ipfsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to store file on IPFS'
      });
    }

    const blockchainResult = await blockchain.storeFileOnBlockchain(
      fileHash,
      ipfsResult.ipfsHash,
      passcodeHash,
      receiverAddress
    );
    if (!blockchainResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to store on blockchain'
      });
    }

    const file = await File.create({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      ipfsHash: ipfsResult.ipfsHash,
      blockchainTxHash: blockchainResult.transactionHash,
      fileHash,
      passcodeHash,
      sender: req.user._id,
      receiverAddress
    });

    res.status(201).json({
      success: true,
      data: {
        id: file._id,
        filename: file.filename,
        ipfsHash: file.ipfsHash,
        blockchainTxHash: file.blockchainTxHash
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Download a file with passcode verification
router.post('/download/:id', authenticate, async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode || !passcodeUtil.validatePasscodeFormat(passcode)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit passcode'
      });
    }

    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.receiverAddress !== req.user.blockchainAddress) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this file'
      });
    }

    const isPasscodeValid = passcodeUtil.comparePasscode(passcode, file.passcodeHash);
    if (!isPasscodeValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid passcode'
      });
    }

    const ipfsResult = await ipfsUtil.retrieveFileFromIpfs(file.ipfsHash);
    if (!ipfsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve from IPFS'
      });
    }

    const decryptionResult = encryption.decryptFile(ipfsResult.fileBuffer, passcode);
    if (!decryptionResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt file'
      });
    }

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`
    });
    res.send(decryptionResult.decryptedBuffer);

    if (!file.isTransferred) {
      file.isTransferred = true;
      await file.save();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all files sent by current user
router.get('/sent', authenticate, async (req, res) => {
  try {
    const files = await File.find({ sender: req.user._id });
    res.status(200).json({
      success: true,
      count: files.length,
      data: files.map(file => ({
        id: file._id,
        filename: file.filename,
        receiverAddress: file.receiverAddress,
        size: file.size,
        createdAt: file.createdAt,
        isTransferred: file.isTransferred
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all files received by current user
router.get('/received', authenticate, async (req, res) => {
  try {
    const files = await File.find({ receiverAddress: req.user.blockchainAddress })
      .populate('sender', 'username');
    
    res.status(200).json({
      success: true,
      count: files.length,
      data: files.map(file => ({
        id: file._id,
        filename: file.filename,
        sender: file.sender.username,
        size: file.size,
        createdAt: file.createdAt,
        isTransferred: file.isTransferred
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 