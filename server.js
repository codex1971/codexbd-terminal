const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const FormData = require('form-data');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ টেলিগ্রাম কনফিগারেশন ============
// ভেরিফাইড টোকেন - @BotFather থেকে নিশ্চিত করুন
const TELEGRAM_BOT_TOKEN = '8725243106:AAFNB3TMkOk-q4KO_z7QL_tvU1FxhoF7Dbk';
const TELEGRAM_CHAT_ID = '6274855215';

console.log('🤖 Telegram Bot Token (first 15 chars):', TELEGRAM_BOT_TOKEN.substring(0, 15) + '...');
console.log('💬 Telegram Chat ID:', TELEGRAM_CHAT_ID);

// টেলিগ্রাম বট ভেরিফিকেশন ফাংশন
async function verifyTelegramBot() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const data = await response.json();
        if (data.ok) {
            console.log('✅ Telegram Bot verified:', data.result.username);
            return true;
        } else {
            console.error('❌ Telegram Bot verification failed:', data.description);
            return false;
        }
    } catch (error) {
        console.error('❌ Cannot connect to Telegram API:', error.message);
        return false;
    }
}

// টেলিগ্রামে মেসেজ পাঠানোর ফাংশন (ইম্প্রুভড)
async function sendToTelegram(message, fileBuffer = null, filename = null, mimeType = null) {
    try {
        // API URL চেক
        const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/`;
        
        if (fileBuffer && filename) {
            // ফাইল সহ পাঠানো
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('caption', message);
            formData.append('document', fileBuffer, {
                filename: filename,
                contentType: mimeType || 'application/octet-stream'
            });

            console.log(`📤 Sending file to Telegram: ${filename} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
            
            const response = await fetch(apiUrl + 'sendDocument', {
                method: 'POST',
                body: formData,
                headers: formData.getHeaders()
            });
            
            const result = await response.json();
            if (!result.ok) {
                console.error('Telegram API Error Details:', JSON.stringify(result, null, 2));
                throw new Error(result.description || 'Failed to send file to Telegram');
            }
            console.log('✅ File sent successfully to Telegram');
            return result;
        } else {
            // শুধু মেসেজ পাঠানো
            console.log(`📤 Sending message to Telegram: ${message.substring(0, 50)}...`);
            
            const response = await fetch(apiUrl + 'sendMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            
            const result = await response.json();
            if (!result.ok) {
                console.error('Telegram API Error Details:', JSON.stringify(result, null, 2));
                throw new Error(result.description || 'Failed to send message to Telegram');
            }
            console.log('✅ Message sent successfully to Telegram');
            return result;
        }
    } catch (error) {
        console.error('❌ Error sending to Telegram:', error.message);
        throw error;
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// আপলোড ফোল্ডার
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer কনফিগারেশন
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// ট্রান্সমিশন হিস্টোরি
let transmissions = [];

// ============ API রাউট ============

// হেলথ চেক (টেলিগ্রাম স্ট্যাটাস সহ)
app.get('/api/health', async (req, res) => {
    const botStatus = await verifyTelegramBot();
    res.json({ 
        status: 'OK', 
        telegram: botStatus,
        botToken: TELEGRAM_BOT_TOKEN ? 'Present' : 'Missing',
        chatId: TELEGRAM_CHAT_ID ? 'Present' : 'Missing',
        timestamp: new Date().toISOString()
    });
});

// সব ট্রান্সমিশন দেখা
app.get('/api/transmissions', (req, res) => {
    res.json(transmissions);
});

// টেলিগ্রাম ডাইরেক্ট টেস্ট এন্ডপয়েন্ট
app.get('/api/test-telegram-direct', async (req, res) => {
    try {
        // প্রথমে বট ভেরিফাই করি
        const botInfo = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const botData = await botInfo.json();
        
        if (!botData.ok) {
            return res.status(400).json({ 
                success: false, 
                error: `Bot invalid: ${botData.description}`,
                botResponse: botData
            });
        }
        
        // টেস্ট মেসেজ পাঠাই
        const testMessage = `🔷 <b>CODEXBD TEST TRANSMISSION</b> 🔷\n━━━━━━━━━━━━━━━━━━━━\n✅ Bot is working properly!\n🤖 Bot: @${botData.result.username}\n⏰ Time: ${new Date().toLocaleString('bn-BD')}\n━━━━━━━━━━━━━━━━━━━━\n🎯 If you see this message, your bot is configured correctly!`;
        
        const sendResult = await sendToTelegram(testMessage);
        
        res.json({ 
            success: true, 
            botInfo: botData.result,
            message: 'Test message sent to Telegram',
            telegramResponse: sendResult
        });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// মেসেজ ও ফাইল সেন্ড করার মেইন এন্ডপয়েন্ট
app.post('/api/send', upload.single('file'), async (req, res) => {
    try {
        const { message } = req.body;
        const file = req.file;
        
        // প্রথমে বট ভেরিফাই
        const botValid = await verifyTelegramBot();
        if (!botValid) {
            throw new Error('Telegram bot token is invalid. Please check your bot token from @BotFather');
        }
        
        let telegramMessage = '';
        let fileBuffer = null;
        let filename = null;
        let mimeType = null;
        
        const timestamp = new Date();
        const timestampStr = timestamp.toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
        
        telegramMessage += `🔷 <b>CODEXBD TRANSMISSION</b> 🔷\n`;
        telegramMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
        telegramMessage += `📡 <b>Status:</b> Received\n`;
        telegramMessage += `⏰ <b>Time:</b> ${timestampStr}\n`;
        telegramMessage += `🆔 <b>ID:</b> <code>${Date.now()}</code>\n`;
        telegramMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
        
        const transmission = {
            id: Date.now(),
            timestamp: timestamp.toISOString(),
            message: message || '',
            file: file ? {
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype
            } : null
        };
        
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                throw new Error('File size exceeds Telegram limit (50MB)');
            }
            
            telegramMessage += `\n📎 <b>ATTACHMENT:</b>\n`;
            telegramMessage += `├ <b>Name:</b> ${escapeTelegram(file.originalname)}\n`;
            telegramMessage += `├ <b>Size:</b> ${(file.size / 1024).toFixed(2)} KB\n`;
            telegramMessage += `└ <b>Type:</b> ${file.mimetype || 'Unknown'}\n`;
            
            if (message && message.trim()) {
                telegramMessage += `\n💬 <b>MESSAGE:</b>\n`;
                telegramMessage += `<code>${escapeTelegram(message)}</code>\n`;
            }
            
            fileBuffer = file.buffer;
            filename = file.originalname;
            mimeType = file.mimetype;
            
            await sendToTelegram(telegramMessage, fileBuffer, filename, mimeType);
        } else if (message && message.trim()) {
            telegramMessage += `\n💬 <b>MESSAGE:</b>\n`;
            telegramMessage += `<code>${escapeTelegram(message)}</code>\n`;
            await sendToTelegram(telegramMessage);
        } else {
            throw new Error('No message or file to send');
        }
        
        transmissions.unshift(transmission);
        if (transmissions.length > 100) {
            transmissions = transmissions.slice(0, 100);
        }
        
        res.json({ 
            success: true, 
            transmission: transmission,
            message: 'Transmission sent to Telegram successfully'
        });
        
    } catch (error) {
        console.error('Error in /api/send:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to send transmission'
        });
    }
});

// মূল পেজ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// হেল্পার ফাংশন
function escapeTelegram(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// সার্ভার স্টার্ট
app.listen(PORT, async () => {
    console.log(`\n🚀 CODEXBD Terminal Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}\n`);
    
    // বট ভেরিফাই করি
    const botValid = await verifyTelegramBot();
    if (!botValid) {
        console.log('\n⚠️  WARNING: Telegram bot token is invalid!');
        console.log('📌 Please fix your bot token:');
        console.log('   1. Go to Telegram and search for @BotFather');
        console.log('   2. Send /mybots and select your bot');
        console.log('   3. Send /token to get a new token');
        console.log('   4. Update TELEGRAM_BOT_TOKEN in server.js\n');
    } else {
        console.log('🎯 Bot is ready to receive messages!\n');
    }
});
