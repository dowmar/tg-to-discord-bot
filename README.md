# Telegram to Discord Bridge Bot

A bot that forwards messages from a Telegram channel to Discord.

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your credentials
3. Install dependencies: `npm install`
4. Start the bot: `npm start` or with PM2: `pm2 start index.js --name telegram-discord-bot`

## Requirements

- Node.js v16 or higher
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))
- Telegram API credentials ([Get them here](https://my.telegram.org/apps))

## Configuration

- TELEGRAM_API_ID: Your Telegram API ID
- TELEGRAM_API_HASH: Your Telegram API Hash
- TELEGRAM_CHANNEL: Channel username without @
- DISCORD_BOT_TOKEN: Your Discord bot token
- DISCORD_CHANNEL_ID: ID of the Discord channel where messages will be forwarded
