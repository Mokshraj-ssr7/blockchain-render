const express = require('express');
const path = require('path');

const app = express();

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'src/frontend')));

// Handle all routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
});

// Start the server
const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
}); 