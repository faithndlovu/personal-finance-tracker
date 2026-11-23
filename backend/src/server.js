require('dotenv').config({ quiet: true });
const os = require('os');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0'; // listen on the LAN so a phone running Expo Go can connect

createApp().listen(PORT, HOST, () => {
  console.log(`Finance Tracker API running on port ${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  Network: http://${n.address}:${PORT}   ← use this from your phone`);
    }
  }
});
