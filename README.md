# CODEXBD Terminal - Telegram File & Message Sender

## Setup Instructions

### 1. Create Telegram Bot
- Talk to [@BotFather](https://t.me/botfather) on Telegram
- Create a new bot and get the **Bot Token**
- Get your **Chat ID** (send a message to your bot, then visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`)

### 2. Local Development
```bash
npm install
echo "TELEGRAM_BOT_TOKEN=your_token_here" > .env
echo "TELEGRAM_CHAT_ID=your_chat_id_here" >> .env
npm start