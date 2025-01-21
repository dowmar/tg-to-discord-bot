// server.js
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const input = require('input');
const fs = require('fs').promises;

const config = {
    apiId: process.env.TELEGRAM_API_ID,
    apiHash: process.env.TELEGRAM_API_HASH,
    channelUsername: process.env.TELEGRAM_CHANNEL,
    session: process.env.TELEGRAM_STRING_SESSION || '',

    discordToken: process.env.DISCORD_BOT_TOKEN,
    discordChannelId: process.env.DISCORD_CHANNEL_ID
};

// Initialize Discord client
const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// handle rate limits, supposed to be 10 messages per second
const messageQueue = [];
let isProcessingQueue = false;

async function processMessageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;

    isProcessingQueue = true;
    const discordChannel = await discord.channels.fetch(config.discordChannelId);

    while (messageQueue.length > 0) {
        try {
            const msg = messageQueue.shift();
            await discordChannel.send(msg);
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Error sending message to Discord:', error);
            // If we hit a rate limit, pause for a longer time
            if (error.code === 429) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    isProcessingQueue = false;
}

async function downloadMedia(client, media) {
    const buffer = await client.downloadMedia(media);
    const tempPath = `./temp_${Date.now()}.jpg`;
    await fs.writeFile(tempPath, buffer);
    return tempPath;
}

async function main() {
    // Me telegram client
    const telegram = new TelegramClient(
        new StringSession(config.session),
        parseInt(config.apiId),
        config.apiHash,
        { connectionRetries: 5 }
    );

    // idk, starting shit
    await telegram.start({
        phoneNumber: async () => await input.text('Phone number: '),
        password: async () => await input.text('Password (if any): '),
        phoneCode: async () => await input.text('Verification code: '),
        onError: (err) => console.log(err),
    });

    console.log('Session string (save this in .env as TELEGRAM_STRING_SESSION):');
    console.log(telegram.session.save());


    const channel = await telegram.getEntity(config.channelUsername);
    console.log(`Monitoring Telegram channel: ${config.channelUsername}`);

    // telegram message handler
    telegram.addEventHandler(async (event) => {
        try {
            if (event instanceof Api.UpdateNewChannelMessage) {
                const message = event.message;


                if (message.peerId.channelId.toString() === channel.id.toString()) {
                    let discordMessage = {
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#0088cc')
                                .setAuthor({
                                    name: config.channelUsername,
                                    iconURL: 'https://telegram.org/img/t_logo.png'
                                })
                                .setTimestamp(new Date(message.date * 1000))
                        ]
                    };

                    if (message.message) {
                        discordMessage.embeds[0].setDescription(message.message);
                    }

                    if (message.media) {
                        try {
                            if (message.media instanceof Api.MessageMediaPhoto) {
                                const photoPath = await downloadMedia(telegram, message.media);
                                discordMessage.files = [photoPath];

                                setTimeout(async () => {
                                    try {
                                        await fs.unlink(photoPath);
                                    } catch (err) {
                                        console.error('Error deleting temp file:', err);
                                    }
                                }, 5000);
                            }
                        } catch (mediaError) {
                            console.error('Error processing media:', mediaError);
                            discordMessage.embeds[0].setFooter({
                                text: 'Error: Could not process media attachment'
                            });
                        }
                    }


                    messageQueue.push(discordMessage);
                    processMessageQueue();
                }
            }
        } catch (error) {
            console.error('Error processing Telegram message:', error);
        }
    });

    discord.once('ready', async () => {
        console.log(`Discord bot logged in as ${discord.user.tag}`);

        try {
            const channel = await discord.channels.fetch(config.discordChannelId);
            const statusEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🟢 Bot Status')
                .addFields(
                    { name: 'Status', value: 'Bot is now online and running' },
                    { name: 'Monitoring', value: `Telegram channel: @${config.channelUsername}` },
                    { name: 'Started at', value: new Date().toLocaleString() }
                )
                .setFooter({ text: 'Bot will forward all messages from the Telegram channel' });

            await channel.send({ embeds: [statusEmbed] });

            discord.user.setActivity(`@${config.channelUsername}`, { type: 'WATCHING' });
        } catch (error) {
            console.error('Failed to send startup message:', error);
        }
    });

    await discord.login(config.discordToken);
}



discord.on('error', async (error) => {
    console.error('Discord error:', error);
    try {
        const channel = await discord.channels.fetch(config.discordChannelId);
        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⚠️ Bot Error')
                    .setDescription('The bot encountered an error. Check console for details.')
                    .setTimestamp()
            ]
        });
    } catch (e) {
        console.error('Failed to send error message:', e);
    }
});

// setInterval(async () => {
//     try {
//         const channel = await discord.channels.fetch(config.discordChannelId);
//         const uptime = Math.floor(process.uptime() / 3600); // hours
//         await channel.send({
//             embeds: [
//                 new EmbedBuilder()
//                     .setColor('#0099FF')
//                     .setTitle('ℹ️ Bot Status Update')
//                     .addFields(
//                         { name: 'Uptime', value: `${uptime} hours` },
//                         { name: 'Queue Size', value: `${messageQueue.length} messages` }
//                     )
//                     .setTimestamp()
//             ]
//         });
//     } catch (error) {
//         console.error('Failed to send status update:', error);
//     }
// }, 3600000); 


main().catch(console.error);

// Handle graceful shutdown
process.once('SIGINT', () => {
    console.log('Shutting down...');
    process.exit(0);
});
process.once('SIGTERM', () => {
    console.log('Shutting down...');
    process.exit(0);
});