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

    client.on('qr', async qr => {
        const qrData = await qrcode.toDataURL(qr);
        sessions[id].qr = qrData;
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
app.get('/status/:id', (req, res) => {
    const session = sessions[req.params.id];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ ready: session.ready || false });
});

// Logout
app.post('/logout', async (req, res) => {
    const { id } = req.body;
    const session = sessions[id];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await session.client.logout();
    delete sessions[id];

    const sessionPath = path.join(__dirname, 'sessions', id);
    fs.rmdirSync(sessionPath, { recursive: true });

    res.json({ message: 'Logged out' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));