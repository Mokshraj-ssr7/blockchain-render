# Secure Blockchain File Transfer

A secure and decentralized system for transferring high-value data files (e.g., sensitive PDFs and photos) using blockchain technology.

## Overview

This system implements a hybrid approach to file transfer by combining:
- Decentralized off-chain storage (IPFS) for the encrypted files
- On-chain recording of file hashes for integrity verification

## Features

1. **Receiver Unique Address Generation**: Receivers can generate a unique blockchain address to share with senders
2. **User Authentication**: Sign in / sign-up functionality for new users
3. **6-Digit Passcode Authentication**: Before sending a file, the sender must provide a 6-digit passcode
4. **Aesthetic Web UI**: Minimalistic black and white theme with white text in the "Black Ops One" font

## Technology Stack

- **Backend**: Node.js, Express.js, Web3.js, IPFS client, MongoDB
- **Frontend**: HTML, CSS, JavaScript with black and white theme
- **Security**: End-to-end encryption, cryptographic hashing, passcode authentication, JWT

## Installation & Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure Environment Variables:
   - Create a `.env` file with:
     - Blockchain endpoint (Infura or local node)
     - IPFS gateway URL
     - JWT secret key
     - MongoDB connection string

4. Start the Server:
   ```
   npm start
   ```

5. Open the Frontend:
   - Open `src/frontend/index.html` in your browser

## License

This project is open source and available under the MIT License. 