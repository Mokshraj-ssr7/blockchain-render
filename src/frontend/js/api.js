// API Handling Module
const API = (function() {
  // Base URL for API calls - use window.location.origin for cross-browser compatibility
  const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : window.location.origin;

  // Helper function for making authenticated requests
  async function fetchWithAuth(url, options = {}) {
    const token = Auth.getToken();
    
    if (!token) {
      throw new Error('Authentication required');
    }
    
    // Format full URL
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    
    console.log(`Making authenticated request to: ${fullUrl}`);
    
    // No Bearer prefix - using token directly as configured in backend
    const defaultHeaders = {
      'Authorization': token
    };
    
    const mergedOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };
    
    try {
      const response = await fetch(fullUrl, mergedOptions).catch(error => {
        console.error(`Network error for ${url}:`, error);
        throw new Error('Network error. Please check if the server is running.');
      });
      
      if (!response) {
        throw new Error('Failed to connect to the server');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          // Handle authentication error
          console.warn('Authentication error, clearing auth data');
          Auth.logout();
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(data.message || `API error: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`Error in fetchWithAuth for ${url}:`, error);
      throw error;
    }
  }
  
  // Generate a new blockchain address
  async function generateAddress() {
    try {
      const data = await fetchWithAuth('/api/receiver/generate', {
        method: 'POST'
      });
      
      return {
        success: true,
        address: data.data.blockchainAddress
      };
    } catch (error) {
      console.error('Generate address error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  // Get current user's blockchain address
  async function getAddress() {
    try {
      const data = await fetchWithAuth('/api/receiver/address');
      
      return {
        success: true,
        address: data.data.blockchainAddress
      };
    } catch (error) {
      console.error('Get address error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  // Verify a receiver's blockchain address
  async function verifyAddress(address) {
    try {
      const response = await fetch(`${BASE_URL}/api/receiver/find/${address}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Address verification failed');
      }
      
      return {
        success: true,
        username: data.data.username,
        address: data.data.blockchainAddress
      };
    } catch (error) {
      console.error('Verify address error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  // Upload a file
  async function uploadFile(file, receiverAddress, passcode, progressCallback) {
    if (!file || !receiverAddress || !passcode) {
      console.error('Missing required parameters:', { 
        hasFile: !!file, 
        hasReceiverAddress: !!receiverAddress, 
        hasPasscode: !!passcode 
      });
      throw new Error('File, receiver address, and passcode are required');
    }

    console.log('Preparing upload for:', {
      fileName: file.name,
      fileSize: file.size,
      receiverAddress: receiverAddress
    });

    try {
      const formData = new FormData();
      
      // Add file
      formData.append('file', file);
      
      // Add other fields
      formData.append('receiverAddress', receiverAddress.trim());
      formData.append('passcode', passcode);
      formData.append('filename', file.name);
      formData.append('size', file.size);
      
      // Log form data for debugging (without showing the passcode)
      const formDataEntries = {};
      for (const [key, value] of formData.entries()) {
        if (key === 'passcode') {
          formDataEntries[key] = '******';
        } else if (key === 'file') {
          formDataEntries[key] = `File: ${value.name}, ${value.size} bytes`;
        } else {
          formDataEntries[key] = value;
        }
      }
      console.log('FormData created:', formDataEntries);
      
      // Create fetch request without setting Content-Type
      // Let the browser set it automatically with the correct boundary
      const response = await fetch(`${BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': Auth.getToken()
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Upload failed:', data);
        throw new Error(data.message || 'File upload failed');
      }
      
      console.log('Upload successful:', data);
      
      return {
        success: true,
        fileData: data.data
      };
    } catch (error) {
      console.error('Error in file upload:', error);
      throw error;
    }
  }
  
  // Get files sent by current user
  async function getSentFiles() {
    try {
      const token = Auth.getToken();
      
      if (!token) {
        console.error('No token available for getSentFiles');
        return { success: false, message: 'Authentication required' };
      }
      
      console.log('Fetching sent files...');
      
      const response = await fetch(`${BASE_URL}/api/files/sent`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      });
      
      const data = await response.json();
      console.log('Sent files API response:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get sent files');
      }
      
      return {
        success: true,
        files: data.files || data.data || []
      };
    } catch (error) {
      console.error('Error getting sent files:', error);
      return {
        success: false,
        message: error.message || 'Network error',
        files: []
      };
    }
  }
  
  // Get files received by current user
  async function getReceivedFiles() {
    try {
      const token = Auth.getToken();
      
      if (!token) {
        console.error('No token available for getReceivedFiles');
        return { success: false, message: 'Authentication required' };
      }
      
      console.log('Fetching received files...');
      
      const response = await fetch(`${BASE_URL}/api/files/received`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      });
      
      const data = await response.json();
      console.log('Received files API response:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get received files');
      }
      
      return {
        success: true,
        files: data.files || []
      };
    } catch (error) {
      console.error('Error getting received files:', error);
      return {
        success: false,
        message: error.message || 'Network error',
        files: []
      };
    }
  }
  
  // Download file with passcode
  async function downloadFile(fileId, passcode, suggestedFilename) {
    if (!fileId) {
      throw new Error('File ID is required');
    }
    
    if (!passcode) {
      throw new Error('Passcode is required');
    }
    
    console.log(`Attempting to download file: ${fileId} with passcode`);
    
    try {
      // First get the download URL
      const token = Auth.getToken();
      
      console.log(`Using token: ${token ? 'yes' : 'no'}`);
      
      const downloadUrl = `${BASE_URL}/api/files/download/${fileId}`;
      console.log(`Download URL: ${downloadUrl}`);
      
      // Show temporary download progress
      const progressEl = document.createElement('div');
      progressEl.className = 'download-progress';
      progressEl.textContent = 'Downloading file...';
      document.body.appendChild(progressEl);
      
      try {
        const response = await fetch(downloadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          body: JSON.stringify({ passcode })
        });
        
        console.log(`Download response status: ${response.status}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Download error response:', errorData);
          throw new Error(errorData.message || `Failed to download file (${response.status})`);
        }
        
        // Get content disposition header to extract filename
        const contentDisposition = response.headers.get('content-disposition');
        let filename = suggestedFilename;
        
        // Extract filename from content disposition if available
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
            console.log(`Using filename from server: ${filename}`);
          }
        }
        
        // Use suggested filename as fallback
        if (!filename) {
          filename = suggestedFilename || 'downloaded-file';
        }
        
        console.log(`Final filename for download: ${filename}`);
        
        // Get the file as a blob
        const blob = await response.blob();
        console.log(`Received file blob: ${blob.size} bytes, type: ${blob.type}`);
        
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          console.log('Download link cleaned up');
        }, 100);
        
        console.log('File download process completed');
        return { success: true };
      } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
      } finally {
        // Always remove progress element
        if (document.body.contains(progressEl)) {
          document.body.removeChild(progressEl);
        }
      }
    } catch (error) {
      console.error('Error in download process:', error);
      throw error;
    }
  }
  
  // Generate a random 6-digit passcode
  function generatePasscode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Refresh user data from server
  async function refreshUser() {
    try {
      const token = Auth.getToken();
      
      if (!token) {
        console.error('No token available for refreshUser');
        return { success: false, message: 'Authentication required' };
      }
      
      console.log('Refreshing user data...');
      
      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to refresh user data');
      }
      
      // Update user data in Auth module
      if (data.success && data.data) {
        Auth.updateCurrentUser(data.data);
        console.log('User data refreshed successfully:', data.data);
      }
      
      return {
        success: true,
        user: data.data || null
      };
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return {
        success: false,
        message: error.message || 'Network error'
      };
    }
  }
  
  // Check if the server is reachable
  async function checkServerStatus() {
    try {
      console.log(`Checking server status at: ${BASE_URL}`);
      const response = await fetch(`${BASE_URL}/api/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // Add cache control to avoid cached responses
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Server status check successful:', data);
        return {
          success: true,
          message: data.message || 'Server is running',
          data: data
        };
      } else {
        console.error('Server status check failed:', response.status);
        return {
          success: false,
          message: `Server returned error: ${response.status}`,
          status: response.status
        };
      }
    } catch (error) {
      console.error('Error checking server status:', error);
      return {
        success: false,
        message: `Cannot connect to server: ${error.message}`,
        error: error
      };
    }
  }
  
  // Return public methods and properties
  return {
    BASE_URL, // Expose BASE_URL for other modules to use
    generateAddress,
    getAddress,
    verifyAddress,
    uploadFile,
    getSentFiles,
    getReceivedFiles,
    downloadFile,
    generatePasscode,
    refreshUser,
    checkServerStatus
  };
})(); 