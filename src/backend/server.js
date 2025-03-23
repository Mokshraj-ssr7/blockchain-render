const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Load env vars
dotenv.config();

// Initialize app
const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS with more permissive settings
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Setup storage directories
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');

// Create directories if they don't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Simple in-memory database for testing
const db = {
  users: [],
  files: [],
  addresses: []
};

// Middleware to log all requests
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Log request headers
  console.log('Headers:', req.headers);
  
  // Log body for non-GET requests (except file uploads)
  if (req.method !== 'GET' && !req.url.includes('/files/upload')) {
    console.log('Body:', req.body);
  }
  
  // Capture the original send function
  const originalSend = res.send;
  
  // Override the send function to log response
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Response ${res.statusCode} (${duration}ms)`);
    
    // For JSON responses, log a summary but not files data which could be large
    if (typeof body === 'string' && body.startsWith('{')) {
      try {
        const data = JSON.parse(body);
        const summary = { ...data };
        
        // Don't log full file data arrays
        if (summary.files && Array.isArray(summary.files)) {
          summary.files = `[${summary.files.length} files]`;
        }
        if (summary.data && Array.isArray(summary.data)) {
          summary.data = `[${summary.data.length} items]`;
        }
        
        console.log('Response data:', summary);
      } catch (e) {
        // Not valid JSON, or other issue
        console.log('Response data: [Not logged - non-JSON or parsing error]');
      }
    }
    
    // Call the original function
    return originalSend.apply(this, arguments);
  };
  
  next();
});

// Middleware for authenticating JWT tokens
function authenticateToken(req, res, next) {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authorization header missing' 
    });
  }
  
  // Extract user ID from token (for the mock system using 'test-token-ID' format)
  // In a real app, you would verify JWT here
  const userId = authHeader.split('-')[2];
  
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token format' 
    });
  }
  
  const user = db.users.find(user => user.id === userId);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'User not found' 
    });
  }
  
  // Set user data in request object
  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    blockchainAddress: user.blockchainAddress
  };
  
  next();
}

// Basic auth route
app.post('/api/auth/register', (req, res) => {
  console.log('Register request received:', req.body);
  
  const { username, email, password } = req.body;
  
  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide username, email and password' 
    });
  }
  
  // Check if user already exists
  if (db.users.find(user => user.email === email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'User already exists with this email' 
    });
  }
  
  // Create new user
  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password, // In production, this should be hashed
    blockchainAddress: null
  };
  
  db.users.push(newUser);
  console.log(`User registered: ${username} (${email}), ID: ${newUser.id}`);
  
  // Return token - use simple format without requiring Bearer prefix
  const token = 'test-token-' + newUser.id;
  
  res.status(201).json({
    success: true,
    token,
    data: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      blockchainAddress: newUser.blockchainAddress
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  
  const { email, password } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide email and password' 
    });
  }
  
  // Find user
  const user = db.users.find(user => user.email === email && user.password === password);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }
  
  console.log(`User logged in: ${user.username} (${email}), ID: ${user.id}`);
  
  // Return token - use simple format without requiring Bearer prefix
  const token = 'test-token-' + user.id;
  
  res.status(200).json({
    success: true,
    token,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      blockchainAddress: user.blockchainAddress
    }
  });
});

app.get('/api/auth/me', (req, res) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authorization header missing' 
    });
  }
  
  // Extract user ID from token
  // The token is in format 'test-token-ID'
  const userId = authHeader.split('-')[2];
  
  console.log(`User data requested for ID: ${userId}`);
  
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token format' 
    });
  }
  
  const user = db.users.find(user => user.id === userId);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'User not found' 
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      blockchainAddress: user.blockchainAddress
    }
  });
});

// Blockchain address routes
app.post('/api/receiver/generate', (req, res) => {
  const userId = req.headers.authorization?.split('-')[2];
  const user = db.users.find(user => user.id === userId);
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  
  // Generate a random blockchain address
  const blockchainAddress = '0x' + Math.random().toString(16).substring(2, 42);
  user.blockchainAddress = blockchainAddress;
  
  res.status(200).json({
    success: true,
    data: {
      blockchainAddress
    }
  });
});

app.get('/api/receiver/address', (req, res) => {
  const userId = req.headers.authorization?.split('-')[2];
  const user = db.users.find(user => user.id === userId);
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }
  
  if (!user.blockchainAddress) {
    return res.status(404).json({ success: false, message: 'No address found' });
  }
  
  res.status(200).json({
    success: true,
    data: {
      blockchainAddress: user.blockchainAddress
    }
  });
});

app.get('/api/receiver/find/:address', (req, res) => {
  const { address } = req.params;
  
  const user = db.users.find(user => user.blockchainAddress === address);
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }
  
  res.status(200).json({
    success: true,
    data: {
      username: user.username,
      blockchainAddress: user.blockchainAddress
    }
  });
});

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/temp');
// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created upload directory:', uploadDir);
}

// Create uploads directory for final files
const finalUploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(finalUploadsDir)) {
  fs.mkdirSync(finalUploadsDir, { recursive: true });
  console.log('Created final uploads directory:', finalUploadsDir);
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Create a safe filename with timestamp and original name
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9\.\-\_]/g, '_');
    cb(null, `${Date.now()}-${safeFilename}`);
  }
});

// Create multer upload middleware
const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1 // Max 1 file at a time
  }
});

// File upload endpoint with expiration info
app.post('/api/files/upload', authenticateToken, (req, res) => {
  // Use multer middleware directly within the route handler
  uploadMiddleware.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        console.error('Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 50MB'
          });
        }
        return res.status(400).json({ 
          success: false, 
          message: `File upload error: ${err.message}`
        });
      } else {
        // An unknown error occurred
        console.error('Unknown upload error:', err);
        return res.status(500).json({
          success: false,
          message: 'File upload failed'
        });
      }
    }
    
    try {
      // Extract data from form data
      console.log('Upload request received:', {
        file: req.file ? req.file.originalname : 'No file',
        receiverAddress: req.body.receiverAddress || 'Not provided',
        passcodeProvided: !!req.body.passcode,
        contentType: req.headers['content-type'] || 'No content type'
      });
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }
      
      // Check if receiver address and passcode are provided
      if (!req.body.receiverAddress) {
        return res.status(400).json({ 
          success: false, 
          message: 'Receiver address is required' 
        });
      }
      
      if (!req.body.passcode) {
        return res.status(400).json({ 
          success: false, 
          message: 'Passcode is required' 
        });
      }
      
      // Get file data from the uploaded temp file
      const fileData = fs.readFileSync(req.file.path);
      console.log(`Read ${fileData.length} bytes from uploaded file`);
      
      // Get the authenticated user ID from token
      const userId = req.headers.authorization?.split('-')[2];
      const user = db.users.find(user => user.id === userId);
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found or authentication expired' 
        });
      }
      
      // Check if sender has a blockchain address
      if (!user.blockchainAddress) {
        // Auto-generate a blockchain address for the user if they don't have one
        user.blockchainAddress = `0x${crypto.randomBytes(6).toString('hex')}`;
        console.log(`Auto-generated blockchain address for user ${userId}: ${user.blockchainAddress}`);
        
        // Add to addresses list
        db.addresses.push(user.blockchainAddress.toLowerCase());
      }
      
      // Clean up the receiver address
      const receiverAddress = String(req.body.receiverAddress).trim();
      console.log(`Clean receiver address: "${receiverAddress}"`);
      
      try {
        // Create file ID first
        const fileId = Date.now().toString();
        
        // Mock IPFS hash (in a real implementation, this would be from an actual IPFS upload)
        const ipfsHash = `ipfs-${crypto.randomBytes(16).toString('hex')}`;
        
        // Mock blockchain transaction (in a real implementation, this would be a real tx hash)
        const blockchainTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        
        // Encrypt the file with the passcode
        const encryptedData = cryptoUtils.encryptFile(fileData, req.body.passcode);
        console.log(`Encrypted file size: ${encryptedData.length} bytes`);
        
        // Create file record
        const fileRecord = {
          id: fileId,
          filename: req.file.originalname,
          size: req.file.size,
          sender: userId,
          senderAddress: user.blockchainAddress,
          receiverAddress: receiverAddress,
          passcode: req.body.passcode,
          ipfsHash: ipfsHash,
          blockchainTxHash: blockchainTxHash,
          isTransferred: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + (60 * 60 * 1000)).toISOString() // 1 hour from now
        };
        
        // For debugging
        console.log('Creating file record:', JSON.stringify(fileRecord, (key, value) => {
          // Mask the passcode
          if (key === 'passcode') return '******';
          return value;
        }, 2));
        
        // Store file record
        db.files.push(fileRecord);
        
        // Save encrypted file to storage
        const filePath = path.join(finalUploadsDir, fileId);
        fs.writeFileSync(filePath, encryptedData);
        
        console.log('File encrypted and saved successfully:', {
          id: fileRecord.id,
          size: fileRecord.size,
          path: filePath,
          ipfsHash: fileRecord.ipfsHash,
          blockchainTxHash: fileRecord.blockchainTxHash
        });
        
        // Clean up temp file
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log(`Deleted temp file: ${req.file.path}`);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
          // Continue anyway since the main operation succeeded
        }
        
        // Add expiration information to the response
        const expirationTime = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now
        
        return res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          file: {
            id: fileRecord.id,
            filename: fileRecord.filename,
            size: fileRecord.size,
            ipfsHash: fileRecord.ipfsHash,
            transactionHash: fileRecord.blockchainTxHash,
            passcode: fileRecord.passcode,
            createdAt: fileRecord.createdAt,
            expiresAt: fileRecord.expiresAt,
            expiresIn: '1 hour'
          }
        });
      } catch (encryptionError) {
        console.error('Encryption error:', encryptionError);
        return res.status(500).json({
          success: false,
          message: 'Error encrypting file: ' + encryptionError.message
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Clean up temp file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Error cleaning up temp file:', err);
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error uploading file: ' + error.message
      });
    }
  });
});

app.get('/api/files/sent', (req, res) => {
  const userId = req.headers.authorization?.split('-')[2];
  
  const files = db.files.filter(file => file.sender === userId);
  
  res.status(200).json({
    success: true,
    data: files
  });
});

// Get files received by the authenticated user
app.get('/api/files/received', (req, res) => {
  try {
    const userId = req.headers.authorization?.split('-')[2];
    const user = db.users.find(user => user.id === userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (!user.blockchainAddress) {
      return res.status(400).json({ 
        success: false, 
        message: 'User does not have a blockchain address'
      });
    }
    
    // Ensure consistent formatting: trim whitespace and convert to lowercase
    const userAddress = String(user.blockchainAddress || '').trim().toLowerCase();
    console.log(`Finding received files for user ${userId} with blockchain address: ${userAddress}`);
    
    // Log all files in the database for debugging
    console.log('All files in database:');
    db.files.forEach(file => {
      console.log(`File ID: ${file.id}, Sender: ${file.senderAddress || 'N/A'}, Receiver: ${file.receiverAddress || 'N/A'}`);
    });
    
    // Find all files where the receiver address matches this user's blockchain address
    const files = db.files.filter(file => {
      if (!file.receiverAddress) {
        console.log(`File ${file.id} has no receiver address`);
        return false;
      }
      
      // Ensure consistent formatting of receiver address: trim whitespace and convert to lowercase
      const fileReceiverAddress = String(file.receiverAddress || '').trim().toLowerCase();
      
      // Perform the comparison
      const isMatch = fileReceiverAddress === userAddress;
      
      console.log(`Comparing - File ${file.id}: receiver="${fileReceiverAddress}", user="${userAddress}", match=${isMatch}`);
      return isMatch;
    });
    
    console.log(`Found ${files.length} files where receiverAddress matches ${userAddress}`);
    
    // Use consistent response format
    res.status(200).json({
      success: true,
      files: files
    });
  } catch (error) {
    console.error('Error getting received files:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET and decrypt a file
app.post('/api/files/download/:fileId', authenticateToken, (req, res) => {
  const fileId = req.params.fileId;
  const { passcode } = req.body;
  
  console.log(`Download request for file ${fileId}`);
  
  if (!passcode) {
    console.log('Passcode missing in request');
    return res.status(400).json({ success: false, message: 'Passcode is required' });
  }
  
  try {
    // Find the file in the database
    console.log('Looking for file in database...');
    console.log(`File ID to find: ${fileId}`);
    console.log(`All file IDs in database: ${db.files.map(f => f.id || f._id).join(', ')}`);
    
    const file = db.files.find(f => 
      (f.id && f.id.toString() === fileId.toString()) || 
      (f._id && f._id.toString() === fileId.toString())
    );
    
    if (!file) {
      console.log(`File not found in database: ${fileId}`);
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    console.log(`File found in database: ${file.filename}`);
    
    // Verify passcode
    if (file.passcode !== passcode) {
      console.log(`Passcode verification failed for file ${fileId}`);
      return res.status(403).json({ success: false, message: 'Invalid passcode' });
    }
    
    console.log('Passcode verified successfully, accessing file...');
    
    // Path to encrypted file
    const filePath = path.join(__dirname, '..', 'uploads', file.id || file._id || fileId);
    console.log(`Looking for file at path: ${filePath}`);
    
    let fileData;
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      try {
        fileData = fs.readFileSync(filePath);
        console.log(`File read from disk: ${filePath}, size: ${fileData.length} bytes`);
      } catch (readError) {
        console.error('Error reading file from disk:', readError);
        fileData = Buffer.from(`Mock file content for ${file.filename}`);
        console.log('Using mock file data instead');
      }
    } else {
      console.log(`File not found on disk at ${filePath}, creating mock data`);
      fileData = Buffer.from(`Mock file content for ${file.filename}`);
    }
    
    try {
      console.log(`Attempting to decrypt file with passcode: ${passcode}`);
      
      // Decrypt the file using cryptoUtils
      const decryptedData = cryptoUtils.decryptFile(fileData, passcode);
      console.log(`File decrypted successfully, size: ${decryptedData.length} bytes`);
      
      // Set content type based on file extension
      const extension = path.extname(file.filename).toLowerCase();
      let contentType = 'application/octet-stream'; // Default
      
      const mimeTypes = {
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.zip': 'application/zip'
      };
      
      if (mimeTypes[extension]) {
        contentType = mimeTypes[extension];
      }
      
      // Set headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.setHeader('Content-Length', decryptedData.length);
      
      console.log(`Sending file ${file.filename} to client (${contentType})`);
      res.send(decryptedData);
      
      console.log(`File ${fileId} downloaded successfully`);
      
    } catch (decryptError) {
      console.error('Error decrypting file:', decryptError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to decrypt file. Invalid passcode or corrupted file.',
        error: decryptError.message
      });
    }
  } catch (error) {
    console.error('Error in download process:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error processing download request',
      error: error.message
    });
  }
});

// Status endpoint to check if server is running
app.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve the main frontend page for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
});

// Crypto utility functions
const cryptoUtils = {
  encryptFile: (fileData, passcode) => {
    console.log(`Encrypting file data (${fileData.length} bytes) with passcode`);
    
    try {
      // For a real implementation, we'd use a more secure approach
      // This is a simplified version for the demo
      
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Use passcode to derive a key (in production, use a proper KDF)
      const key = crypto.createHash('sha256').update(String(passcode)).digest();
      
      // Create cipher with AES-256-CBC
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt the file data
      const encryptedData = Buffer.concat([
        cipher.update(fileData),
        cipher.final()
      ]);
      
      // Prepend IV to encrypted data for use in decryption
      const result = Buffer.concat([iv, encryptedData]);
      console.log(`Encryption successful: ${result.length} bytes`);
      return result;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Encryption failed: ' + error.message);
    }
  },
  
  decryptFile: (encryptedData, passcode) => {
    console.log(`Decrypting data (${encryptedData.length} bytes) with passcode`);
    
    try {
      // Extract the IV from the beginning of the encrypted data
      const iv = encryptedData.slice(0, 16);
      
      // The rest is the encrypted file data
      const encryptedFileData = encryptedData.slice(16);
      
      // Derive key from passcode (same as in encryption)
      const key = crypto.createHash('sha256').update(String(passcode)).digest();
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt the file data
      const decrypted = Buffer.concat([
        decipher.update(encryptedFileData),
        decipher.final()
      ]);
      
      console.log(`Decryption successful: ${decrypted.length} bytes`);
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed. Invalid passcode or corrupted file.');
    }
  }
};

// Set user's blockchain address
app.post('/api/user/blockchain-address', authenticateToken, (req, res) => {
  try {
    const userId = req.userId;
    const user = db.users.find(user => user.id === userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Validate address
    const { blockchainAddress } = req.body;
    
    if (!blockchainAddress) {
      return res.status(400).json({ 
        success: false, 
        message: 'Blockchain address is required' 
      });
    }
    
    // Ensure consistent formatting of the blockchain address
    const formattedAddress = String(blockchainAddress).trim();
    console.log(`Setting blockchain address for user ${userId}: ${formattedAddress}`);
    
    // Update user record
    user.blockchainAddress = formattedAddress;
    
    // Update addresses list for tracking
    if (!db.addresses.includes(formattedAddress.toLowerCase())) {
      db.addresses.push(formattedAddress.toLowerCase());
    }
    
    console.log('Updated blockchain address successfully');
    
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        blockchainAddress: user.blockchainAddress
      }
    });
  } catch (error) {
    console.error('Error setting blockchain address:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Initialize cleanup timer for auto-deletion of files after 1 hour
function initializeFileCleanup() {
  console.log('Initializing automatic file cleanup system');
  
  // Check every 5 minutes for files that need to be deleted
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
  const FILE_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds
  
  // Set up recurring cleanup
  setInterval(() => {
    console.log('Running scheduled file cleanup check...');
    cleanupExpiredFiles(FILE_EXPIRY_TIME);
  }, CLEANUP_INTERVAL);
  
  // Also run cleanup on startup
  cleanupExpiredFiles(FILE_EXPIRY_TIME);
}

// Cleanup expired files
function cleanupExpiredFiles(expiryTime) {
  const now = Date.now();
  let cleanupCount = 0;
  
  // Filter out expired files
  db.files = db.files.filter(file => {
    // Skip files without createdAt timestamp
    if (!file.createdAt) {
      console.warn(`File ${file.id || file._id} missing creation timestamp, skipping cleanup check`);
      return true; // Keep file
    }
    
    const fileDate = new Date(file.createdAt).getTime();
    const fileAge = now - fileDate;
    
    // Check if file is expired
    if (fileAge > expiryTime) {
      console.log(`File ${file.id || file._id} (${file.filename}) is expired (${Math.round(fileAge / 60000)} minutes old). Deleting...`);
      
      try {
        // Delete the actual file from disk
        const filePath = path.join(__dirname, '..', 'uploads', file.id || file._id || '');
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file from disk: ${filePath}`);
        } else {
          console.log(`File not found on disk: ${filePath}`);
        }
        
        cleanupCount++;
        return false; // Remove from database
      } catch (error) {
        console.error(`Error deleting file ${file.id || file._id}:`, error);
        return true; // Keep in database on error
      }
    }
    
    return true; // Keep non-expired files
  });
  
  if (cleanupCount > 0) {
    console.log(`Cleanup complete: removed ${cleanupCount} expired files`);
  } else {
    console.log('No expired files found during cleanup');
  }
}

// Initialize cleanup when server starts
initializeFileCleanup();

// Add a test route to check IPFS and blockchain services
app.get('/api/test/services', async (req, res) => {
  try {
    // Import the IPFS and blockchain utilities
    const ipfsUtil = require('./utils/ipfs');
    const blockchainUtil = require('./utils/blockchain');
    
    // Create a sample buffer
    const sampleBuffer = Buffer.from('This is a test file for hash generation');
    
    // Test IPFS
    console.log('Testing IPFS service...');
    const ipfsResult = await ipfsUtil.storeFileOnIpfs(sampleBuffer);
    
    // Test blockchain
    console.log('Testing blockchain service...');
    const blockchainResult = await blockchainUtil.storeFileOnBlockchain(
      'TestFileHash', 
      ipfsResult.ipfsHash,
      'TestPasscodeHash',
      '0xTestReceiverAddress'
    );
    
    // Return combined results
    res.status(200).json({
      success: true,
      ipfs: ipfsResult,
      blockchain: blockchainResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Service test error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing services',
      error: error.message
    });
  }
}); 