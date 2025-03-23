const crypto = require('crypto');

// Encrypt a file buffer with a passcode
exports.encryptFile = (fileBuffer, passcode) => {
  try {
    // Generate a key from the passcode
    const key = crypto
      .createHash('sha256')
      .update(passcode)
      .digest();
    
    // Create an initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt the file buffer
    const encryptedBuffer = Buffer.concat([
      iv,
      cipher.update(fileBuffer),
      cipher.final()
    ]);
    
    return {
      encryptedBuffer,
      success: true
    };
  } catch (error) {
    console.error('File encryption error:', error);
    return {
      success: false,
      error: 'Failed to encrypt file'
    };
  }
};

// Decrypt a file buffer with a passcode
exports.decryptFile = (encryptedBuffer, passcode) => {
  try {
    // Extract the IV from the beginning of the encrypted buffer
    const iv = encryptedBuffer.slice(0, 16);
    const encryptedData = encryptedBuffer.slice(16);
    
    // Generate a key from the passcode
    const key = crypto
      .createHash('sha256')
      .update(passcode)
      .digest();
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // Decrypt the file buffer
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    return {
      decryptedBuffer,
      success: true
    };
  } catch (error) {
    console.error('File decryption error:', error);
    return {
      success: false,
      error: 'Failed to decrypt file. Incorrect passcode or corrupted file.'
    };
  }
};

// Generate a hash for a file buffer
exports.hashFile = (fileBuffer) => {
  return crypto
    .createHash('sha256')
    .update(fileBuffer)
    .digest('hex');
};

// Hash a 6-digit passcode
exports.hashPasscode = (passcode) => {
  return crypto
    .createHash('sha256')
    .update(passcode)
    .digest('hex');
};

// Verify passcode format (6-digit number)
exports.validatePasscode = (passcode) => {
  const passcodeRegex = /^\d{6}$/;
  return passcodeRegex.test(passcode);
}; 