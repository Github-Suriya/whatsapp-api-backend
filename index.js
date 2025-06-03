const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const sessions = {};

// Create a new session
app.post('/create-session', async (req, res) => {
    const { id } = req.body;

    if (sessions[id]) return res.json({ message: 'Session already exists' });

    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: `./sessions/${id}` }),
        puppeteer: { headless: true, args: ['--no-sandbox'] }
    });

    sessions[id] = { client };

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        sessions[sessionId].qr = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`;
    });

    client.on('ready', () => {
        console.log(`Client ${id} is ready`);
        sessions[id].ready = true;
    });

    client.on('authenticated', () => {
        console.log(`Client ${id} authenticated`);
    });

    client.initialize();
    res.json({ message: 'Session initializing' });
});

// Get QR Code
app.get('/qr/:id', (req, res) => {
    const { id } = req.params;
    const session = sessions[id];
    if (!session || !session.qr) return res.status(404).json({ error: 'QR not available' });
    res.json({ qr: session.qr });
});

// Check Session Status
app.get('/status/:id', async (req, res) => {
    const session = sessions[req.params.id];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    res.json({
        status: session.ready ? 'authenticated' : 'pending',
        qr: session.qr || null,
    });
});

// Logout
app.post('/logout', async (req, res) => {
  const { id } = req.body;

  if (!sessions[id]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    await sessions[id].client.logout();
    delete sessions[id];
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Send Message
app.post('/send-message', async (req, res) => {
  const { id, number, message } = req.body;

  if (!sessions[id]) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
    const client = sessions[id].client;

    await client.sendMessage(formattedNumber, message);
    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error('Send Message Error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));