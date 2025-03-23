// UI Handling Module
const UI = (function() {
  // DOM elements
  let pages;
  let navLinks;
  let authRequired;
  let authNotRequired;
  let logoutBtn;
  let getStartedBtn;
  let toastContainer;
  
  // Initialize UI
  function init() {
    // Cache DOM elements
    pages = document.querySelectorAll('.page');
    navLinks = document.querySelectorAll('nav a');
    logoutBtn = document.getElementById('logout-btn');
    authRequired = document.querySelectorAll('.auth-required');
    authNotRequired = document.querySelectorAll('.auth-not-required');
    toastContainer = document.getElementById('toast-container');
    getStartedBtn = document.getElementById('get-started-btn');
    
    if(!toastContainer) {
      console.error('Toast container not found in DOM. Creating one.');
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Get page from URL hash or default to home
    const initialPage = window.location.hash.substring(1) || 'home';
    navigateTo(initialPage);
    
    // Update UI based on auth status
    updateAuthUI();
    
    // Set up navigation
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('href').substring(1);
        navigateTo(page);
      });
    });
    
    // Listen for hash changes to update the page
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.substring(1) || 'home';
      navigateTo(page);
    });
    
    // Set up logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        updateAuthUI();
        navigateTo('home');
        showToast('You have been logged out', 'info');
        
        // Clear file check timestamp
        localStorage.removeItem('lastFileCheck');
      });
    }
    
    // Add custom event listener for login status changes
    window.addEventListener('auth-status-changed', (event) => {
      if (event.detail.isLoggedIn) {
        // User just logged in - check for new files
        setTimeout(() => {
          checkForNewFiles();
        }, 2000);
      }
    });
    
    // Setup get started button if it exists
    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', () => {
        if (Auth.isLoggedIn()) {
          navigateTo('upload');
        } else {
          navigateTo('register');
        }
      });
    }
    
    // Set up download modal
    setupDownloadModal();
    
    // Create section headers if missing
    ensureSectionHeaders();
    
    console.log('UI initialized');
  }
  
  // Navigate to a page
  function navigateTo(page) {
    // Hide all pages first
    clearPage();
    
    // Show requested page
    if (page === 'home') {
      document.getElementById('home-page').classList.add('active');
    } else if (page === 'address') {
      document.getElementById('address-page').classList.add('active');
    } else if (page === 'register') {
      document.getElementById('register-page').classList.add('active');
    } else if (page === 'login') {
      document.getElementById('login-page').classList.add('active');
    } else if (page === 'upload') {
      document.getElementById('upload-page').classList.add('active');
      // Reset any previous upload results
      document.getElementById('upload-form').classList.remove('hidden');
      document.getElementById('upload-progress').classList.add('hidden');
      document.getElementById('upload-result').classList.add('hidden');
    } else if (page === 'files') {
      showFilesPage();
    }
    
    // Update active nav link
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
      link.classList.remove('active');
      
      // Check if this link corresponds to the requested page
      if (link.getAttribute('href') === `#${page}`) {
        link.classList.add('active');
      }
    });
    
    // Scroll to top
    window.scrollTo(0, 0);
  }
  
  // Update UI based on authentication status
  function updateAuthUI() {
    const isLoggedIn = Auth.isLoggedIn();
    
    // Show/hide elements based on auth status
    authRequired.forEach(el => {
      el.style.display = isLoggedIn ? '' : 'none';
    });
    
    authNotRequired.forEach(el => {
      el.style.display = isLoggedIn ? 'none' : '';
    });
  }
  
  // Show toast notification
  function showToast(message, type = 'info', duration = 3000) {
    // Ensure toast container exists
    if (!toastContainer) {
      console.error('Toast container not found. Creating one.');
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Log message for debugging
    console.log(`Toast: ${message} (${type})`);
    
    // Remove after duration
    setTimeout(() => {
      toast.remove();
    }, duration);
  }
  
  // Format file size for display
  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 Bytes';
    
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
  }
  
  // Format date for display
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
  
  // Create a file card
  function createFileCard(file, type) {
    // Debug log the file data
    console.log(`Creating ${type} file card:`, file);
    
    // Get file ID (support both formats)
    const fileId = file.id || file._id;
    console.log(`File ID: ${fileId}`);
    
    if (!file.filename) {
      console.warn('File missing filename:', file);
    }
    
    // Create card element
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.fileId = fileId || '';
    
    // Format file size
    const formattedSize = formatFileSize(file.size);
    
    // Format date
    const formattedDate = formatDate(file.createdAt);
    
    // Calculate expiration status
    let expirationInfo = '';
    let timeRemainingBar = '';
    if (file.expiresAt) {
      const now = new Date();
      const expiry = new Date(file.expiresAt);
      const diffMs = expiry - now;
      const timeRemaining = getTimeRemaining(expiry);
      
      if (diffMs <= 0) {
        // File has expired
        expirationInfo = `<p class="file-meta file-expired">Expired <span class="expired-label">Expired</span></p>`;
        
        // Add expired class to card
        card.classList.add('expired-file');
      } else {
        // File still valid
        const percentRemaining = Math.min(100, Math.max(0, (diffMs / (60 * 60 * 1000)) * 100));
        const isCritical = diffMs < 15 * 60 * 1000; // Less than 15 minutes
        
        // Visual time remaining bar
        timeRemainingBar = `
          <div class="time-remaining">
            <span class="countdown-icon"><i class="fas fa-clock"></i></span>
            <div class="time-bar ${isCritical ? 'time-critical' : ''}">
              <div class="time-bar-fill" style="width: ${percentRemaining}%"></div>
            </div>
          </div>
        `;
        
        // Add expiration info with countdown
        expirationInfo = `
          <p class="file-meta file-expiry ${isCritical ? 'soon' : ''}">
            Expires in: ${timeRemaining}
            <span class="expiration-countdown">
              <i class="fas fa-clock countdown-icon"></i>${formatExpiryTime(expiry)}
            </span>
          </p>
          ${timeRemainingBar}
        `;
      }
    }
    
    // Base card content
    let cardContent = `
      <div class="file-icon">
        <i class="fas fa-file"></i>
      </div>
      <div class="file-details">
        <h3 class="file-name">${file.filename || 'Unnamed file'}</h3>
        <p class="file-meta">Size: ${formattedSize}</p>
        <p class="file-meta">Date: ${formattedDate}</p>
        ${expirationInfo}
    `;
    
    // Add type-specific content
    if (type === 'sent') {
      cardContent += `
        <p class="file-meta">Sent to: ${file.receiverAddress || 'Unknown'}</p>
        <p class="file-meta">Passcode: ${file.passcode ? '******' : 'Not available'}</p>
      </div>
      `;
    } else if (type === 'received') {
      cardContent += `
        <p class="file-meta">From: ${file.senderAddress || 'Unknown'}</p>
      </div>
      
      <button class="btn btn-primary download-btn" ${new Date() > new Date(file.expiresAt) ? 'disabled' : ''}>
        ${new Date() > new Date(file.expiresAt) ? 'Expired' : 'Download'}
      </button>
      `;
    }
    
    // Set card content
    card.innerHTML = cardContent;
    
    // Add download button for received files that aren't expired
    if (type === 'received') {
      const downloadBtn = card.querySelector('.download-btn');
      if (downloadBtn && !downloadBtn.disabled) {
        downloadBtn.addEventListener('click', () => {
          console.log(`Download requested for file: ${fileId}`);
          showDownloadModal(fileId, file.filename);
        });
      }
    }
    
    return card;
  }
  
  // Format expiry time in HH:MM format
  function formatExpiryTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
  
  // Show download modal for a file
  function showDownloadModal(fileId, filename) {
    console.log(`Showing download modal for file: ${fileId}, filename: ${filename}`);
    
    // Make sure we have a fileId
    if (!fileId) {
      console.error('No fileId provided to showDownloadModal');
      showToast('Error: Cannot download file (missing ID)', 'error');
      return;
    }
    
    // Get or create the modal
    let downloadModal = document.getElementById('downloadModal');
    
    if (!downloadModal) {
      console.log('Creating new download modal');
      downloadModal = document.createElement('div');
      downloadModal.id = 'downloadModal';
      downloadModal.className = 'modal';
      
      // Create modal content with improved design
      downloadModal.innerHTML = `
        <div class="modal-content">
          <span class="close">&times;</span>
          <h2>Download Secure File</h2>
          <p>Enter the 6-digit passcode provided by the sender to decrypt and download <strong id="download-filename">${filename || 'this file'}</strong>.</p>
          
          <form id="download-form">
            <div class="form-group">
              <label for="download-passcode">Passcode:</label>
              <input type="text" id="download-passcode" required placeholder="Enter 6-digit passcode" 
                     maxlength="6" pattern="[0-9]{6}" autocomplete="off">
            </div>
            <div id="download-status"></div>
            <button type="submit" class="btn">
              <span class="btn-text">Download File</span>
              <i class="fas fa-download"></i>
            </button>
          </form>
          
          <div class="modal-footer">
            <p class="security-note">
              <i class="fas fa-shield-alt"></i> This file is encrypted and can only be decrypted with the correct passcode.
            </p>
          </div>
        </div>
      `;
      
      document.body.appendChild(downloadModal);
      
      // Close button functionality
      const closeBtn = downloadModal.querySelector('.close');
      closeBtn.addEventListener('click', function() {
        downloadModal.style.display = 'none';
      });
      
      // Close modal when clicking outside
      window.addEventListener('click', function(event) {
        if (event.target === downloadModal) {
          downloadModal.style.display = 'none';
        }
      });
      
      // Add keydown event for pressing Escape to close
      window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && downloadModal.style.display === 'block') {
          downloadModal.style.display = 'none';
        }
      });
    } else {
      // Update filename in existing modal
      const filenameEl = downloadModal.querySelector('#download-filename');
      if (filenameEl) {
        filenameEl.textContent = filename || 'this file';
      }
    }
    
    // Always get fresh references to form elements
    const downloadForm = downloadModal.querySelector('#download-form');
    const passcodeInput = downloadModal.querySelector('#download-passcode');
    const statusDiv = downloadModal.querySelector('#download-status');
    
    if (!downloadForm || !passcodeInput || !statusDiv) {
      console.error('Download modal is missing required elements');
      return;
    }
    
    // Clear previous status
    statusDiv.innerHTML = '';
    
    // Add input validation for passcode
    passcodeInput.addEventListener('input', function() {
      // Only allow numbers
      this.value = this.value.replace(/[^0-9]/g, '');
      
      // Max 6 digits
      if (this.value.length > 6) {
        this.value = this.value.slice(0, 6);
      }
    });
    
    // Remove any previous event listeners by cloning and replacing
    const newForm = downloadForm.cloneNode(true);
    downloadForm.parentNode.replaceChild(newForm, downloadForm);
    
    // Add submit handler to the new form
    const updatedForm = downloadModal.querySelector('#download-form');
    updatedForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      
      const passcode = updatedForm.querySelector('#download-passcode').value.trim();
      const statusEl = updatedForm.querySelector('#download-status');
      const submitBtn = updatedForm.querySelector('button[type="submit"]');
      
      if (!passcode) {
        statusEl.innerHTML = '<div class="error-message">Please enter a passcode</div>';
        return;
      }
      
      if (passcode.length !== 6) {
        statusEl.innerHTML = '<div class="error-message">Passcode must be 6 digits</div>';
        return;
      }
      
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-text">Downloading...</span><i class="fas fa-spinner fa-spin"></i>';
        statusEl.innerHTML = '<div class="info-message">Decrypting and downloading file...</div>';
        
        console.log(`Downloading file ${fileId} with passcode ${passcode}`);
        
        await API.downloadFile(fileId, passcode, filename);
        
        statusEl.innerHTML = '<div class="success-message">Download started successfully!</div>';
        
        // Reset form and enable button after delay
        setTimeout(() => {
          passcodeInput.value = '';
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="btn-text">Download File</span><i class="fas fa-download"></i>';
          
          // Close modal after successful download
          setTimeout(() => {
            downloadModal.style.display = 'none';
          }, 1500);
        }, 1000);
      } catch (error) {
        console.error('Download error:', error);
        statusEl.innerHTML = `<div class="error-message">Download failed: ${error.message}</div>`;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-text">Try Again</span><i class="fas fa-download"></i>';
      }
    });
    
    // Clear previous input value
    passcodeInput.value = '';
    
    // Focus on the input field
    setTimeout(() => {
      passcodeInput.focus();
    }, 100);
    
    // Show the modal
    downloadModal.style.display = 'block';
  }
  
  // Add notification badge to navigation
  function addNotificationBadge(count) {
    // Find the files link in navigation
    const filesLink = document.querySelector('a[data-page="files"]');
    if (!filesLink) {
      console.warn('Files link not found in navigation');
      return;
    }
    
    // Remove existing badge if any
    const existingBadge = filesLink.querySelector('.notification-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Create and add new badge
    const badge = document.createElement('span');
    badge.className = 'notification-badge';
    badge.textContent = count;
    badge.setAttribute('data-count', count);
    filesLink.appendChild(badge);
    console.log(`Added notification badge with count: ${count}`);
  }
  
  // Check for new files and display notifications
  async function checkForNewFiles() {
    const user = Auth.getUser();
    if (!user) {
      console.log('No user logged in, skipping new file check');
      return;
    }
    
    console.log('Checking for new files for user:', user.email || user.username);
    try {
      const result = await API.getReceivedFiles();
      if (!result || !result.success) {
        console.log('Failed to get received files:', result ? result.message : 'No result');
        return;
      }
      
      const receivedFiles = result.files || [];
      console.log(`Found ${receivedFiles.length} total files`);
      
      // If no files, just return
      if (receivedFiles.length === 0) {
        return;
      }
      
      // Get the last check time
      const lastCheckTime = localStorage.getItem('lastFileCheck') || 0;
      console.log('Last check time:', new Date(parseInt(lastCheckTime)).toLocaleString());
      
      // Make sure lastCheckTime is a valid number
      const lastCheckAsNumber = parseInt(lastCheckTime);
      if (isNaN(lastCheckAsNumber)) {
        console.log('Invalid lastCheckTime, resetting to 0');
        localStorage.setItem('lastFileCheck', '0');
        return;
      }
      
      // Filter for new files
      const newFiles = receivedFiles.filter(file => {
        try {
          if (!file.createdAt) {
            console.warn('File missing createdAt timestamp:', file);
            return false;
          }
          
          const fileTime = new Date(file.createdAt).getTime();
          if (isNaN(fileTime)) {
            console.warn('Invalid file date format:', file.createdAt);
            return false;
          }
          
          const isNew = fileTime > lastCheckAsNumber;
          console.log(`File ${file.id || file._id}: created ${new Date(fileTime).toLocaleString()}, last check ${new Date(lastCheckAsNumber).toLocaleString()}, isNew: ${isNew}`);
          return isNew;
        } catch (e) {
          console.error('Error processing file date:', e);
          return false;
        }
      });
      
      console.log(`Found ${newFiles.length} new files since last check`);
      
      // Only update badges and show notifications if we found new files
      if (newFiles.length > 0) {
        // Add notification badge to navigation
        addNotificationBadge(newFiles.length);
        
        // Show a toast notification
        showToast(`You have ${newFiles.length} new file${newFiles.length === 1 ? '' : 's'}!`, 'toast-new-files');
        
        // If we're on the files page, refresh it to show the new files
        if (document.getElementById('files-page').classList.contains('active')) {
          App.loadFiles(true);
        }
      }
    } catch (error) {
      console.error('Error checking for new files:', error);
    }
  }
  
  // Clear file notifications
  function clearFileNotifications() {
    const filesLink = document.querySelector('a[data-page="files"]');
    if (filesLink) {
      const badge = filesLink.querySelector('.notification-badge');
      if (badge) badge.remove();
    }
  }
  
  // Setup download modal (called in init)
  function setupDownloadModal() {
    // Check if modal already exists
    if (document.getElementById('download-modal')) {
      return;
    }
    
    // Create download modal structure
    const modal = document.createElement('div');
    modal.id = 'download-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>Download File</h2>
        <p>Enter the passcode to decrypt and download this file:</p>
        <form id="download-form">
          <div class="form-group">
            <label for="download-passcode">Passcode:</label>
            <input type="password" id="download-passcode" required>
          </div>
          <button type="submit" class="btn btn-primary">Download</button>
        </form>
        <div id="download-status"></div>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(modal);
    
    console.log('Download modal created and added to DOM');
  }
  
  // Show loading state
  function showLoading() {
    // Create or get loading overlay
    let loadingOverlay = document.getElementById('loading-overlay');
    
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'loading-overlay';
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      `;
      document.body.appendChild(loadingOverlay);
      
      // Add style for loading overlay if not in CSS
      const style = document.createElement('style');
      style.textContent = `
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .loading-spinner {
          border: 5px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 5px solid white;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-overlay p {
          color: white;
          margin-top: 10px;
        }
      `;
      document.head.appendChild(style);
    }
    
    loadingOverlay.style.display = 'flex';
  }
  
  // Hide loading state
  function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }
  
  // Show error message
  function showError(message) {
    showToast(message, 'error', 5000);
    console.error('App Error:', message);
  }
  
  // Show files page
  function showFilesPage() {
    clearPage();
    document.getElementById('files-page').classList.add('active');
    
    // Show loading spinner
    showLoading();
    
    // Add refresh button to the received files section
    const receivedFilesHeader = document.querySelector('#received-files .section-header');
    
    // Clear any existing refresh button
    const existingBtn = receivedFilesHeader.querySelector('.refresh-btn');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    // Create new refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn btn-sm refresh-btn';
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Files';
    refreshBtn.addEventListener('click', () => {
      console.log('Refresh button clicked - forcing refresh');
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
      
      // Force refresh received files
      App.loadFiles(true);
      
      // Re-enable button after a short delay
      setTimeout(() => {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Files';
      }, 2000);
    });
    
    // Add the button
    receivedFilesHeader.appendChild(refreshBtn);
    
    // Load files
    App.loadFiles();
  }
  
  // Display a critical error message (for connection issues)
  function showConnectionError(message) {
    // Update the connection status indicator
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
      connectionStatus.style.display = 'block';
      connectionStatus.className = 'connection-status error';
      connectionStatus.querySelector('.status-icon').textContent = '❌';
      connectionStatus.querySelector('.status-message').textContent = message;
    }
    
    // First try to get or create an error container
    let errorContainer = document.getElementById('connection-error-container');
    
    if (!errorContainer) {
      // Create error container
      errorContainer = document.createElement('div');
      errorContainer.id = 'connection-error-container';
      errorContainer.className = 'connection-error-container';
      
      // Add to body
      document.body.appendChild(errorContainer);
    }
    
    // Set message and add retry button
    errorContainer.innerHTML = `
      ${message}
      <button id="retry-connection-btn">Retry</button>
    `;
    
    // Add event listener to retry button
    document.getElementById('retry-connection-btn').addEventListener('click', async () => {
      errorContainer.innerHTML = 'Checking connection...';
      
      // Update connection status
      if (connectionStatus) {
        connectionStatus.className = 'connection-status';
        connectionStatus.querySelector('.status-icon').textContent = '⚠️';
        connectionStatus.querySelector('.status-message').textContent = 'Checking connection...';
      }
      
      try {
        const result = await API.checkServerStatus();
        if (result.success) {
          // Connection restored
          errorContainer.style.backgroundColor = '#5cb85c';
          errorContainer.innerHTML = 'Connection restored! Reloading page...';
          
          // Update connection status
          if (connectionStatus) {
            connectionStatus.className = 'connection-status success';
            connectionStatus.querySelector('.status-icon').textContent = '✅';
            connectionStatus.querySelector('.status-message').textContent = 'Connected to server!';
          }
          
          // Reload page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          // Still not connected
          errorContainer.innerHTML = `
            Cannot connect to server: ${result.message}
            <button id="retry-connection-btn">Retry</button>
          `;
          
          // Update connection status
          if (connectionStatus) {
            connectionStatus.className = 'connection-status error';
            connectionStatus.querySelector('.status-icon').textContent = '❌';
            connectionStatus.querySelector('.status-message').textContent = `Cannot connect to server: ${result.message}`;
          }
          
          // Reattach event listener
          document.getElementById('retry-connection-btn').addEventListener('click', () => {
            window.location.reload();
          });
        }
      } catch (error) {
        errorContainer.innerHTML = `
          Error checking connection: ${error.message}
          <button id="retry-connection-btn">Retry</button>
        `;
        
        // Update connection status
        if (connectionStatus) {
          connectionStatus.className = 'connection-status error';
          connectionStatus.querySelector('.status-icon').textContent = '❌';
          connectionStatus.querySelector('.status-message').textContent = `Connection error: ${error.message}`;
        }
        
        // Reattach event listener
        document.getElementById('retry-connection-btn').addEventListener('click', () => {
          window.location.reload();
        });
      }
    });
  }
  
  // Clear all pages (hide all pages)
  function clearPage() {
    pages.forEach(page => {
      page.classList.remove('active');
    });
  }
  
  // Create section headers if missing
  function ensureSectionHeaders() {
    // Check for sent files section header
    let sentFilesHeader = document.querySelector('#sent-files .section-header');
    if (!sentFilesHeader) {
      const sentFiles = document.getElementById('sent-files');
      if (sentFiles) {
        sentFilesHeader = document.createElement('div');
        sentFilesHeader.className = 'section-header';
        sentFilesHeader.innerHTML = '<h3>Files You\'ve Sent</h3>';
        
        // Insert at the beginning of the sent files section
        if (sentFiles.firstChild) {
          sentFiles.insertBefore(sentFilesHeader, sentFiles.firstChild);
        } else {
          sentFiles.appendChild(sentFilesHeader);
        }
      }
    }
    
    // Check for received files section header
    let receivedFilesHeader = document.querySelector('#received-files .section-header');
    if (!receivedFilesHeader) {
      const receivedFiles = document.getElementById('received-files');
      if (receivedFiles) {
        receivedFilesHeader = document.createElement('div');
        receivedFilesHeader.className = 'section-header';
        receivedFilesHeader.innerHTML = '<h3>Files You\'ve Received</h3>';
        
        // Insert at the beginning of the received files section
        if (receivedFiles.firstChild) {
          receivedFiles.insertBefore(receivedFilesHeader, receivedFiles.firstChild);
        } else {
          receivedFiles.appendChild(receivedFilesHeader);
        }
      }
    }
  }
  
  // Return public methods
  return {
    init,
    navigateTo,
    updateAuthUI,
    showToast,
    formatFileSize,
    formatDate,
    createFileCard,
    checkForNewFiles,
    clearFileNotifications,
    addNotificationBadge,
    showLoading,
    hideLoading,
    showError,
    showFilesPage,
    showConnectionError
  };
})(); 