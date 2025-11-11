const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;

async function startBot() {
    if (isConnected) return;
    
    console.log('🚀 Starting WhatsApp Bot...');
    
    try {
        // Auth state
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        
        // Create socket
        const sock = makeWASocket({
            logger: { level: 'silent' },
            printQRInTerminal: false,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000
        });

        // QR Code
        sock.ev.on('connection.update', (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr) {
                console.log('📱 Scan QR Code ini dengan WhatsApp:');
                qrcode.generate(qr, { small: true });
                retryCount = 0; // Reset retry count when QR is generated
            }
            
            if (connection === 'open') {
                isConnected = true;
                retryCount = 0;
                console.log('✅ Bot berhasil terhubung!');
            }
            
            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('❌ Koneksi terputus, status:', statusCode);
                
                if (statusCode !== 401) { // 401 means logged out
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        console.log(`🔄 Coba reconnect... (${retryCount}/${MAX_RETRIES})`);
                        setTimeout(() => startBot(), 5000);
                    } else {
                        console.log('❌ Max retries reached. Silakan restart manual.');
                    }
                } else {
                    console.log('❌ Session expired. Silakan scan QR lagi.');
                }
            }
            
            console.log('Connection update:', connection);
        });

        // Save credentials
        sock.ev.on('creds.update', saveCreds);

        // Handle messages
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const message = m.messages[0];
                
                if (!message.message || message.key.remoteJid === 'status@broadcast') return;
                
                const text = message.message.conversation || 
                            message.message.extendedTextMessage?.text || '';
                
                const sender = message.key.remoteJid;
                const command = text.toLowerCase().trim();
                
                console.log(`📨 Pesan dari ${sender}: ${text}`);
                
                // Simple commands
                if (command === '!ping') {
                    await sock.sendMessage(sender, { text: '🏓 Pong!' });
                }
                else if (command === '!menu') {
                    const menu = `🤖 *BOT MENU*

📝 *Perintah yang tersedia:*
• !ping - Test bot
• !menu - Menu bot
• !info - Info bot
• !owner - Pemilik bot

📌 Bot sederhana by GitHub`;
                    await sock.sendMessage(sender, { text: menu });
                }
                else if (command === '!info') {
                    await sock.sendMessage(sender, { 
                        text: '🤖 Bot WhatsApp Sederhana\nDibuat dengan Baileys\nHost: Termux' 
                    });
                }
                else if (command === '!owner') {
                    await sock.sendMessage(sender, { 
                        text: '👨‍💻 Owner: Your Name\n📧 Contact: your@email.com' 
                    });
                }
                else if (command.startsWith('!say ')) {
                    const sayText = text.substring(5);
                    if (sayText) {
                        await sock.sendMessage(sender, { text: sayText });
                    }
                }
            } catch (error) {
                console.log('Error handling message:', error);
            }
        });

    } catch (error) {
        console.log('❌ Error starting bot:', error);
        isConnected = false;
        
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`🔄 Restarting... (${retryCount}/${MAX_RETRIES})`);
            setTimeout(() => startBot(), 5000);
        }
    }
}

// Handle process exit
process.on('SIGINT', () => {
    console.log('\n🛑 Bot dihentikan manual');
    process.exit(0);
});

// Start bot
startBot();
