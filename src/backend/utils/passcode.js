const crypto = require('crypto');

// Generate a secure random 6-digit passcode
exports.generatePasscode = () => {
  // Generate a random number between 100000 and 999999
  const min = 100000;
  const max = 999999;
  
  // Use crypto.randomInt for better randomness
  return crypto.randomInt(min, max + 1).toString();
};

// Validate a passcode format (must be a 6-digit number)
exports.validatePasscodeFormat = (passcode) => {
  const passcodeRegex = /^\d{6}$/;
  return passcodeRegex.test(passcode);
};

// Hash a passcode for storage
exports.hashPasscode = (passcode) => {
  return crypto
    .createHash('sha256')
    .update(passcode.toString())
    .digest('hex');
};

// Compare a passcode with its hash
exports.comparePasscode = (passcode, passcodeHash) => {
  const hashedInput = exports.hashPasscode(passcode);
  return hashedInput === passcodeHash;
}; 