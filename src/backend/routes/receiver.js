const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Middleware to check authentication
const authenticate = async (req, res, next) => {
  try {
    // Get auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    
    // Get token from header
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// @desc    Generate a new blockchain address for the user
// @route   POST /api/receiver/generate
// @access  Private
router.post('/generate', authenticate, async (req, res) => {
  try {
    // Generate a new blockchain address
    const address = await req.user.generateBlockchainAddress();
    
    res.status(200).json({
      success: true,
      data: {
        blockchainAddress: address
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

// @desc    Get current user's blockchain address
// @route   GET /api/receiver/address
// @access  Private
router.get('/address', authenticate, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        blockchainAddress: req.user.blockchainAddress
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

// @desc    Find a user by blockchain address
// @route   GET /api/receiver/find/:address
// @access  Public
router.get('/find/:address', async (req, res) => {
  try {
    const user = await User.findOne({ blockchainAddress: req.params.address });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this blockchain address'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        username: user.username,
        blockchainAddress: user.blockchainAddress
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

module.exports = router; 