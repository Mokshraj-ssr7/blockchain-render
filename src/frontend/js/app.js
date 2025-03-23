// Main Application Module
const App = (function() {
  // Initialize the application
  function init() {
    // Initialize UI
    UI.init();
    
    // Check server connectivity first
    checkServerConnectivity().then(isConnected => {
      if (isConnected) {
        console.log('Server connection confirmed');
        
        // Set up event listeners
        setupEventListeners();
        
        // Load user data if logged in
        if (Auth.isLoggedIn()) {
          // First try to refresh user data from the server
          API.refreshUser().then(result => {
            if (result.success) {
              console.log('User data refreshed on startup');
            } else {
              console.warn('Could not refresh user data, using cached data:', result.message);
            }
            
            // Load user data (from cache if refresh failed)
            loadUserData();
            
            // Check for new files
            setTimeout(() => {
              console.log('Checking for new files at startup');
              UI.checkForNewFiles();
            }, 2000); // Wait 2 seconds to ensure all data is loaded
          });
        }
        
        // Setup file polling if user is logged in (check every 30 seconds)
        setupFilePolling();
      } else {
        // If server is not connected, show error message
        console.error('Cannot connect to server, showing error message');
        UI.showError('Cannot connect to server. Please check if the server is running and try again.');
      }
    });
  }
  
  // Check server connectivity
  async function checkServerConnectivity() {
    // Show connection status
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
      connectionStatus.style.display = 'block';
      connectionStatus.className = 'connection-status';
      connectionStatus.querySelector('.status-message').textContent = 'Checking connection to server...';
    }
    
    try {
      const result = await API.checkServerStatus();
      if (result.success) {
        // Update connection status
        if (connectionStatus) {
          connectionStatus.className = 'connection-status success';
          connectionStatus.querySelector('.status-icon').textContent = '✅';
          connectionStatus.querySelector('.status-message').textContent = 'Connected to server!';
          
          // Hide after 3 seconds
          setTimeout(() => {
            connectionStatus.style.display = 'none';
          }, 3000);
        }
        
        // Hide any existing connection error
        const errorContainer = document.getElementById('connection-error-container');
        if (errorContainer) {
          errorContainer.style.display = 'none';
        }
        return true;
      } else {
        console.error('Server connectivity check failed:', result.message);
        
        // Update connection status
        if (connectionStatus) {
          connectionStatus.className = 'connection-status error';
          connectionStatus.querySelector('.status-icon').textContent = '❌';
          connectionStatus.querySelector('.status-message').textContent = `Cannot connect to server: ${result.message}`;
        }
        
        UI.showConnectionError(`Cannot connect to server: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('Error checking server connectivity:', error);
      
      // Update connection status
      if (connectionStatus) {
        connectionStatus.className = 'connection-status error';
        connectionStatus.querySelector('.status-icon').textContent = '❌';
        connectionStatus.querySelector('.status-message').textContent = `Connection error: ${error.message}`;
      }
      
      UI.showConnectionError(`Connection error: ${error.message}`);
      return false;
    }
  }
  
  // Set up all event listeners
  function setupEventListeners() {
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
    
    // Upload form
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
      uploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // Receiver address change listener
    const receiverAddressInput = document.getElementById('receiver-address');
    if (receiverAddressInput) {
      receiverAddressInput.addEventListener('input', () => {
        // Clear verification status when address is changed
        receiverAddressInput.setAttribute('data-verified', 'false');
        receiverAddressInput.classList.remove('verified-address');
        document.getElementById('receiver-info').classList.add('hidden');
      });
    }
    
    // Address verification
    const verifyAddressBtn = document.getElementById('verify-address-btn');
    if (verifyAddressBtn) {
      verifyAddressBtn.addEventListener('click', handleAddressVerification);
    }
    
    // Passcode generation
    const generatePasscodeBtn = document.getElementById('generate-passcode-btn');
    if (generatePasscodeBtn) {
      generatePasscodeBtn.addEventListener('click', () => {
        document.getElementById('passcode').value = API.generatePasscode();
      });
    }
    
    // Address generation
    const generateAddressBtn = document.getElementById('generate-address-btn');
    if (generateAddressBtn) {
      generateAddressBtn.addEventListener('click', handleAddressGeneration);
    }
    
    // Copy address button
    const copyAddressBtn = document.getElementById('copy-address-btn');
    if (copyAddressBtn) {
      copyAddressBtn.addEventListener('click', () => {
        const addressEl = document.getElementById('user-blockchain-address');
        navigator.clipboard.writeText(addressEl.textContent)
          .then(() => {
            UI.showToast('Address copied to clipboard', 'success');
          })
          .catch(() => {
            UI.showToast('Failed to copy address', 'error');
          });
      });
    }
    
    // Tab switching in files page
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.getAttribute('data-tab');
        
        // Update active tab button
        tabBtns.forEach(tab => tab.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update active tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-files`).classList.add('active');
      });
    });
    
    // "Learn More" button
    const learnMoreBtn = document.getElementById('learn-more-btn');
    if (learnMoreBtn) {
      learnMoreBtn.addEventListener('click', () => {
        // Scroll to features section
        const featuresSection = document.querySelector('.features');
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }
  
  // Handle user registration
  async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirmPassword = document.getElementById('register-confirm-password').value.trim();
    
    // Basic validation
    if (!username || !email || !password) {
      UI.showToast('Please fill in all fields', 'error');
      return;
    }
    
    if (password !== confirmPassword) {
      UI.showToast('Passwords do not match', 'error');
      return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Registering...';
    submitBtn.disabled = true;
    
    try {
      // Call Auth module register method
      const result = await Auth.register(username, email, password);
      
      if (result.success) {
        UI.showToast('Registered successfully!', 'success');
        UI.updateAuthUI();
        UI.navigateTo('home');
      } else {
        UI.showToast(result.message || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      UI.showToast(error.message || 'An unexpected error occurred', 'error');
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
  
  // Handle user login
  async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    // Basic validation
    if (!email || !password) {
      UI.showToast('Please enter email and password', 'error');
      return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
      // Call Auth module login method
      const result = await Auth.login(email, password);
      
      if (result.success) {
        UI.showToast('Logged in successfully!', 'success');
        UI.updateAuthUI();
        UI.navigateTo('home');
      } else {
        UI.showToast(result.message || 'Login failed. Check your credentials.', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      UI.showToast(error.message || 'Network error. Is the server running?', 'error');
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }
  
  // Handle file upload
  async function handleFileUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('file-input');
    const receiverAddressInput = document.getElementById('receiver-address');
    const passcodeInput = document.getElementById('passcode');
    
    // Get trimmed values and ensure they exist
    const receiverAddress = receiverAddressInput.value.trim();
    const passcode = passcodeInput.value.trim();
    
    console.log('File upload form values:', {
      file: fileInput.files.length ? fileInput.files[0].name : 'No file selected',
      receiverAddress: receiverAddress || 'Empty',
      passcodeLength: passcode ? passcode.length : 0
    });
    
    // Validate form
    if (!fileInput.files.length) {
      UI.showToast('Please select a file', 'error');
      return;
    }
    
    if (!receiverAddress) {
      UI.showToast('Please enter a receiver address', 'error');
      receiverAddressInput.focus();
      return;
    }
    
    if (receiverAddress.length < 10) {
      UI.showToast('Receiver address appears to be invalid', 'error');
      receiverAddressInput.focus();
      return;
    }
    
    // Check if address was verified 
    const isVerified = receiverAddressInput.getAttribute('data-verified') === 'true';
    if (!isVerified) {
      const confirmContinue = confirm("The receiver address hasn't been verified. Are you sure you want to continue?");
      if (!confirmContinue) {
        // User chose not to continue
        document.getElementById('verify-address-btn').focus();
        return;
      }
    }
    
    if (!passcode || passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
      UI.showToast('Please enter a valid 6-digit passcode', 'error');
      passcodeInput.focus();
      return;
    }

    console.log('Uploading file to receiver:', receiverAddress);
    
    // Hide form and show progress
    const uploadForm = document.getElementById('upload-form');
    const uploadProgress = document.getElementById('upload-progress');
    const progressFill = uploadProgress.querySelector('.progress-fill');
    const statusText = document.getElementById('upload-status');
    
    uploadForm.classList.add('hidden');
    uploadProgress.classList.remove('hidden');
    progressFill.style.width = '0%';
    statusText.textContent = 'Preparing upload...';
    
    try {
      // Upload file (our method doesn't support progress yet, so we'll simulate it)
      let uploadStarted = false;
      
      // Start a progress simulation
      const progressInterval = setInterval(() => {
        if (!uploadStarted) return;
        
        const currentWidth = parseInt(progressFill.style.width) || 0;
        if (currentWidth < 90) {
          const newWidth = currentWidth + (Math.random() * 5);
          progressFill.style.width = `${newWidth}%`;
          statusText.textContent = `Uploading: ${Math.round(newWidth)}%`;
        }
      }, 300);
      
      uploadStarted = true;
      
      // Upload the file
      const result = await API.uploadFile(
        fileInput.files[0],
        receiverAddress,
        passcode
      );
      
      // Clear interval and show 100%
      clearInterval(progressInterval);
      progressFill.style.width = '100%';
      statusText.textContent = 'Upload complete!';
      
      // Show success view after a short delay
      setTimeout(() => {
        uploadProgress.classList.add('hidden');
        const uploadResult = document.getElementById('upload-result');
        uploadResult.classList.remove('hidden');
        
        // Fill in file details
        document.getElementById('uploaded-filename').textContent = result.fileData.filename;
        
        // Display IPFS hash with formatting
        const ipfsHashElement = document.getElementById('uploaded-ipfs-hash');
        if (result.fileData.ipfsHash) {
          ipfsHashElement.textContent = result.fileData.ipfsHash;
          ipfsHashElement.classList.add('success-value');
        } else {
          ipfsHashElement.textContent = 'N/A';
        }
        
        // Display blockchain transaction with formatting
        const blockchainTxElement = document.getElementById('uploaded-blockchain-tx');
        if (result.fileData.blockchainTxHash) {
          blockchainTxElement.textContent = result.fileData.blockchainTxHash;
          blockchainTxElement.classList.add('success-value');
        } else {
          blockchainTxElement.textContent = 'N/A';
        }
        
        // Display receiver address
        document.getElementById('uploaded-receiver').textContent = result.fileData.receiverAddress;
        
        // Show success message
        UI.showToast('File uploaded and transferred successfully!', 'success');
        
        // Reset form for future uploads
        uploadForm.reset();
        
        // Reset verification status
        receiverAddressInput.setAttribute('data-verified', 'false');
        receiverAddressInput.classList.remove('verified-address');
        document.getElementById('receiver-info').classList.add('hidden');
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      UI.showToast(error.message, 'error');
      uploadProgress.classList.add('hidden');
      uploadForm.classList.remove('hidden');
    }
  }
  
  // Handle blockchain address verification
  async function handleAddressVerification() {
    const addressInput = document.getElementById('receiver-address');
    const address = addressInput.value.trim();
    
    if (!address) {
      UI.showToast('Please enter an address to verify', 'error');
      addressInput.focus();
      return;
    }
    
    // Show loading state
    const verifyBtn = document.getElementById('verify-address-btn');
    const originalText = verifyBtn.textContent;
    verifyBtn.textContent = 'Verifying...';
    verifyBtn.disabled = true;
    
    try {
      const result = await API.verifyAddress(address);
      
      if (result.success) {
        // Show receiver info
        const receiverInfo = document.getElementById('receiver-info');
        const receiverUsername = document.getElementById('receiver-username');
        
        // Store the verified address back in the input field to ensure it's clean
        addressInput.value = result.address;
        
        receiverUsername.textContent = result.username;
        receiverInfo.classList.remove('hidden');
        
        // Add a visual indicator that the address is verified
        addressInput.classList.add('verified-address');
        addressInput.setAttribute('data-verified', 'true');
        
        UI.showToast('Address verified successfully', 'success');
      } else {
        // Clear verification if failed
        addressInput.setAttribute('data-verified', 'false');
        addressInput.classList.remove('verified-address');
        
        // Hide receiver info
        const receiverInfo = document.getElementById('receiver-info');
        receiverInfo.classList.add('hidden');
        
        UI.showToast(result.message || 'Address verification failed', 'error');
      }
    } catch (error) {
      // Clear verification on error
      addressInput.setAttribute('data-verified', 'false');
      addressInput.classList.remove('verified-address');
      
      console.error('Verification error:', error);
      UI.showToast(error.message || 'Address verification failed', 'error');
    } finally {
      // Reset button state
      verifyBtn.textContent = originalText;
      verifyBtn.disabled = false;
    }
  }
  
  // Handle blockchain address generation
  async function handleAddressGeneration() {
    // Show loading state
    const generateBtn = document.getElementById('generate-address-btn');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    
    try {
      const result = await API.generateAddress();
      
      if (result.success) {
        // Update address display
        const addressElement = document.getElementById('user-blockchain-address');
        addressElement.textContent = result.address;
        
        UI.showToast('New blockchain address generated', 'success');
      } else {
        UI.showToast(result.message, 'error');
      }
    } catch (error) {
      UI.showToast(error.message, 'error');
    } finally {
      // Reset button state
      generateBtn.textContent = originalText;
      generateBtn.disabled = false;
    }
  }
  
  // Load user data and update UI
  async function loadUserData() {
    // Check if user has blockchain address
    const addressElement = document.getElementById('user-blockchain-address');
    
    if (addressElement) {
      const user = Auth.getCurrentUser();
      
      if (user && user.blockchainAddress) {
        addressElement.textContent = user.blockchainAddress;
      } else {
        // Try to get address from API
        try {
          const result = await API.getAddress();
          
          if (result.success && result.address) {
            addressElement.textContent = result.address;
          } else {
            addressElement.textContent = 'No address generated yet';
          }
        } catch (error) {
          console.error('Error getting address:', error);
          addressElement.textContent = 'Error loading address';
        }
      }
    }
    
    // Load files if on files page
    if (document.getElementById('files-page').classList.contains('active')) {
      loadFiles();
    }
  }
  
  // Set up polling for new files
  function setupFilePolling() {
    console.log('Setting up file polling...');
    
    // Clear any existing polling
    if (window.filePollingInterval) {
      clearInterval(window.filePollingInterval);
    }
    
    // Immediately check for files
    if (Auth.isLoggedIn()) {
      setTimeout(() => {
        console.log('Initial file check on setup...');
        UI.checkForNewFiles();
      }, 2000);
    }
    
    // Set polling interval - check for files every 15 seconds if user is logged in
    // (more frequent polling for better responsiveness)
    window.filePollingInterval = setInterval(() => {
      if (Auth.isLoggedIn()) {
        console.log('Polling for new files...');
        UI.checkForNewFiles();
      } else {
        // Clear interval if user logs out
        console.log('User not logged in, stopping file polling');
        clearInterval(window.filePollingInterval);
        window.filePollingInterval = null;
      }
    }, 15000); // 15 seconds
    
    console.log('File polling started');
    
    // Set up event listener for auth status changes
    window.addEventListener('auth-status-changed', (event) => {
      const isLoggedIn = event.detail?.isLoggedIn;
      console.log(`Auth status changed: ${isLoggedIn ? 'logged in' : 'logged out'}`);
      
      if (isLoggedIn) {
        console.log('User logged in, starting file polling');
        // Restart polling if it was stopped
        if (!window.filePollingInterval) {
          setupFilePolling();
        }
      } else {
        console.log('User logged out, stopping file polling');
        // Stop polling when logged out
        if (window.filePollingInterval) {
          clearInterval(window.filePollingInterval);
          window.filePollingInterval = null;
        }
      }
    });
  }
  
  // Load user's files
  async function loadFiles(forceRefresh = false) {
    console.log('Loading files, forceRefresh =', forceRefresh);
    UI.showLoading();
    UI.clearFileNotifications();
    
    try {
      // Get sent files
      const sentResult = await API.getSentFiles();
      console.log('Sent files loaded:', sentResult);
      const sentFilesContainer = document.getElementById('sent-files-list');
      
      // Clear the container before adding new content
      if (sentFilesContainer) {
        sentFilesContainer.innerHTML = '';
        
        if (sentResult.success && sentResult.files && sentResult.files.length > 0) {
          sentResult.files.forEach(file => {
            const fileCard = UI.createFileCard(file, 'sent');
            sentFilesContainer.appendChild(fileCard);
          });
        } else {
          sentFilesContainer.innerHTML = '<p class="no-files">No files sent yet.</p>';
        }
      } else {
        console.error('Sent files container not found in DOM');
      }
      
      // Get received files - use consistent format for API response
      const receivedResult = await API.getReceivedFiles();
      console.log('Received files loaded:', receivedResult);
      const receivedFilesContainer = document.getElementById('received-files-list');
      
      // Clear the container before adding new content
      if (receivedFilesContainer) {
        receivedFilesContainer.innerHTML = '';
        
        // Determine if we have files (handle both result formats)
        const receivedFiles = receivedResult.success ? 
          (receivedResult.files || receivedResult.data || []) : [];
        
        console.log('Received files array:', receivedFiles);
        
        if (receivedFiles.length > 0) {
          console.log(`Processing ${receivedFiles.length} received files...`);
          
          // Check if there are new files since last check
          const lastCheckTime = forceRefresh ? 0 : (localStorage.getItem('lastFileCheck') || 0);
          console.log('Last check time:', new Date(parseInt(lastCheckTime)).toLocaleString());
          
          const newFiles = receivedFiles.filter(file => {
            // Make sure file has a valid createdAt timestamp
            if (!file.createdAt) {
              console.warn('File missing createdAt timestamp:', file);
              return false;
            }
            
            try {
              const fileTimestamp = new Date(file.createdAt).getTime();
              const isNew = fileTimestamp > parseInt(lastCheckTime);
              console.log(`File ${file.id || file._id}: created ${new Date(fileTimestamp).toLocaleString()}, isNew: ${isNew}`);
              return isNew;
            } catch (e) {
              console.error('Error parsing file timestamp:', e);
              return false;
            }
          });
          
          // If there are new files, show notification
          if (newFiles.length > 0) {
            // Create file notifications UI with more attention-grabbing elements
            const notificationArea = createFileNotification(newFiles, receivedFilesContainer);
            
            // Show a toast notification
            UI.showToast(`You have ${newFiles.length} new file${newFiles.length === 1 ? '' : 's'}!`, 'toast-new-files');
            
            // Add badge to the files link in navigation
            UI.addNotificationBadge(newFiles.length);
          }
          
          // Create file cards for received files
          receivedFiles.forEach(file => {
            try {
              console.log('Creating card for file:', file);
              const fileCard = UI.createFileCard(file, 'received');
              receivedFilesContainer.appendChild(fileCard);
              
              // Mark new files
              if (newFiles.some(newFile => {
                const newFileId = newFile.id || newFile._id;
                const fileId = file.id || file._id;
                return newFileId === fileId;
              })) {
                console.log(`Marking file ${file.id || file._id} as new`);
                fileCard.classList.add('new-file');
                
                // Add "New" label if not already present
                if (!fileCard.querySelector('.new-file-label')) {
                  const newLabel = document.createElement('div');
                  newLabel.className = 'new-file-label';
                  newLabel.textContent = 'NEW';
                  fileCard.appendChild(newLabel);
                }
              }
            } catch (err) {
              console.error('Error creating file card:', err, file);
            }
          });
          
          // Don't update the last check time automatically - wait for user acknowledgment
          if (newFiles.length === 0 || forceRefresh) {
            localStorage.setItem('lastFileCheck', Date.now().toString());
          }
        } else {
          receivedFilesContainer.innerHTML = '<p class="no-files">No files received yet.</p>';
        }
      } else {
        console.error('Received files container not found in DOM');
      }
      
      // Show success message if was a manual refresh
      if (forceRefresh) {
        UI.showToast('Files refreshed successfully', 'success');
      }
    } catch (error) {
      console.error('Error loading files:', error);
      UI.showError('Failed to load files: ' + (error.message || 'Unknown error'));
    } finally {
      UI.hideLoading();
    }
  }
  
  // Create file notifications UI with more attention-grabbing elements
  function createFileNotification(newFiles, container) {
    console.log(`Creating notification for ${newFiles.length} new files`);
    
    // Create notification area
    const notificationArea = document.createElement('div');
    notificationArea.className = 'notification-area pulsing';
    
    // Create alert with attention-grabbing animation
    const alert = document.createElement('div');
    alert.className = 'alert alert-info';
    alert.innerHTML = `
      <div class="notification-icon">
        <i class="fas fa-bell"></i>
      </div>
      <div class="notification-content">
        <strong>You have ${newFiles.length} new file${newFiles.length === 1 ? '' : 's'}!</strong>
        <p>New files have been transferred to your account</p>
      </div>
      <button id="acknowledge-btn" class="btn btn-sm">Acknowledge</button>
    `;
    
    notificationArea.appendChild(alert);
    container.insertBefore(notificationArea, container.firstChild);
    
    // Add acknowledge button functionality
    const acknowledgeBtn = document.getElementById('acknowledge-btn');
    if (acknowledgeBtn) {
      acknowledgeBtn.addEventListener('click', () => {
        notificationArea.remove();
        localStorage.setItem('lastFileCheck', Date.now().toString());
        UI.clearFileNotifications();
      });
    }
    
    // Add animation to make it more noticeable
    setTimeout(() => {
      notificationArea.classList.add('active');
    }, 100);
    
    return notificationArea;
  }
  
  // Show upload success view
  function showUploadSuccess(fileData) {
    // Hide upload form and progress
    document.getElementById('upload-form').classList.add('hidden');
    document.getElementById('upload-progress').classList.add('hidden');
    
    // Show result with file details
    const resultElement = document.getElementById('upload-result');
    resultElement.classList.remove('hidden');
    
    // Format expiration time
    const expiresAt = fileData.expiresAt ? new Date(fileData.expiresAt) : null;
    const formattedExpiry = expiresAt ? expiresAt.toLocaleString() : 'Unknown';
    const timeRemaining = expiresAt ? getTimeRemaining(expiresAt) : '1 hour';
    
    // Show file details
    resultElement.innerHTML = `
      <h2><i class="fas fa-check-circle"></i> File Uploaded Successfully</h2>
      
      <dl>
        <dt>File Name:</dt>
        <dd>${fileData.filename}</dd>
        
        <dt>File Size:</dt>
        <dd>${UI.formatFileSize(fileData.size)}</dd>
        
        <dt>Passcode:</dt>
        <dd class="success-value">${fileData.passcode}</dd>
        
        <dt>IPFS Hash:</dt>
        <dd class="success-value">${fileData.ipfsHash}</dd>
        
        <dt>Blockchain Transaction:</dt>
        <dd class="success-value">${fileData.transactionHash || fileData.blockchainTxHash}</dd>
        
        <dt>Expires At:</dt>
        <dd>${formattedExpiry} (in ${timeRemaining})</dd>
      </dl>
      
      <div class="important-note">
        <strong>Important:</strong> 
        <p>Share the passcode with the receiver securely. 
        They will need it to decrypt and download the file.</p>
        <p>This file will be automatically deleted after 1 hour.</p>
      </div>
      
      <div class="form-group" style="margin-top: 20px; text-align: center;">
        <button id="upload-another-btn" class="btn btn-primary">Upload Another File</button>
      </div>
    `;
    
    // Add event listener to "Upload Another" button
    document.getElementById('upload-another-btn').addEventListener('click', () => {
      resetUploadForm();
    });
    
    // Log success
    console.log('File uploaded successfully:', fileData);
  }
  
  // Calculate time remaining in a human-readable format
  function getTimeRemaining(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry - now;
    
    // If already expired, return "Expired"
    if (diffMs <= 0) {
      return "Expired";
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours} hour${hours !== 1 ? 's' : ''} ${mins > 0 ? `and ${mins} minute${mins !== 1 ? 's' : ''}` : ''}`;
    }
  }
  
  // Return public methods
  return {
    init,
    loadUserData,
    loadFiles
  };
})();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', App.init); 