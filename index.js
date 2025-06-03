const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const sessions = {};

// Create a new WhatsApp session
app.post('/create-session', (req, res) => {
  const sessionId = req.body.id;
  if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

  if (sessions[sessionId]) {
    return res.json({ message: 'Session already exists' });
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  sessions[sessionId] = { client, ready: false, qr: null };

  client.on('qr', (qr) => {
    console.log(`QR Received for session ${sessionId}`);
    sessions[sessionId].qr = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
  });

  client.on('ready', () => {
    console.log(`Client ready for session ${sessionId}`);
    sessions[sessionId].ready = true;
    sessions[sessionId].qr = null;
  });

  client.on('authenticated', () => {
    console.log(`Authenticated session ${sessionId}`);
  });

  client.on('disconnected', () => {
    console.log(`Client disconnected: ${sessionId}`);
    delete sessions[sessionId];
  });

  client.initialize();

  res.json({ message: 'Session created', id: sessionId });
});

// Get session status + QR
app.get('/status/:id', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({
    status: session.ready ? 'authenticated' : 'pending',
    qr: session.qr || null
  });
});

// Send a message
app.post('/send-message', async (req, res) => {
  const { id, number, message } = req.body;
  const session = sessions[id];

  if (!session || !session.ready) {
    return res.status(400).json({ error: 'Session not ready or not found' });
  }

  try {
    const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    await session.client.sendMessage(formattedNumber, message);
    res.json({ message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

// Logout and destroy session
app.post('/logout', async (req, res) => {
  const sessionId = req.body.id;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    await session.client.logout();
    await session.client.destroy();
    delete sessions[sessionId];
    res.json({ message: 'Logged out and session destroyed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout session' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});