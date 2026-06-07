const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Telegram send function
async function sendToTelegram(message, filePath, originalName) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        throw new Error('Telegram credentials missing');
    }

    try {
        // Send message first
        if (message && message.trim()) {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: `📨 New message from CODEXBD:\n\n${message}`,
                parse_mode: 'HTML'
            });
        }

        // Send file if exists
        if (filePath && fs.existsSync(filePath)) {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('document', fs.createReadStream(filePath), originalName);

            await axios.post(`https://api.telegram.org/bot${botToken}/sendDocument`, formData, {
                headers: formData.getHeaders()
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Telegram Error:', error.response?.data || error.message);
        throw error;
    }
}

// API Routes
app.post('/api/send', upload.single('file'), async (req, res) => {
    let uploadedFile = null;

    try {
        const { message } = req.body;
        const file = req.file;

        if (!message && !file) {
            return res.status(400).json({ error: 'Message or file required' });
        }

        const result = await sendToTelegram(
            message || '',
            file ? file.path : null,
            file ? file.originalname : null
        );

        // Clean up uploaded file
        if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        res.json({ 
            success: true, 
            message: 'Successfully sent to Telegram',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Clean up on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ 
            error: 'Failed to send to Telegram',
            details: error.message 
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'active', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`CODEXBD Terminal Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});