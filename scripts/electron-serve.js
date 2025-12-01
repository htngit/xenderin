const { spawn } = require('child_process');
const path = require('path');

// Set environment variable for VITE_DEV_SERVER_URL
process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173';

// Start the Electron app
const electron = spawn(
  'electron',
  ['.'],
  { 
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }
  }
);

electron.on('close', (code) => {
  console.log(`Electron process exited with code ${code}`);
});