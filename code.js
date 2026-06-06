// session_generator.js
// Generates a session ID and sends it to your WhatsApp. Run: node session_generator.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const {
    makeWASocket,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    Browsers,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const OWNER_PHONE = '27785028986'; // <-- your number (digits only)
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const PUBLIC_DIR = path.join(__dirname, 'public'); // <- ADDED

// Ensure both directories exist
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true }); // <- FIX

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// Beautiful web page
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Taragon Bot - Session Generator</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:#0a0a0f;min-height:100vh;display:flex;justify-content:center;align-items:center;overflow:hidden}
        .bg{position:fixed;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle at 30% 40%,rgba(102,126,234,0.15),transparent 50%),radial-gradient(circle at 70% 60%,rgba(118,75,162,0.15),transparent 50%);animation:rotate 30s linear infinite;z-index:0}
        @keyframes rotate{to{transform:rotate(360deg)}}
        .flags{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1}
        .flag{position:absolute;font-size:24px;animation:float linear infinite;opacity:0.4}
        @keyframes float{0%{transform:translateY(110vh) rotate(0deg)}to{transform:translateY(-10vh) rotate(720deg)}}
        .card{position:relative;z-index:10;background:rgba(255,255,255,0.03);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px;max-width:500px;width:92%;box-shadow:0 25px 50px rgba(0,0,0,0.5)}
        .logo{font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;text-align:center;background:linear-gradient(135deg,#667eea,#764ba2,#f093fb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
        .subtitle{text-align:center;color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:24px}
        .code-box{text-align:center;margin:24px 0}
        .code-label{color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
        .code{font-family:'Space Grotesk',monospace;font-size:52px;font-weight:700;letter-spacing:18px;color:#667eea;padding:28px 20px;background:rgba(102,126,234,0.08);border-radius:16px;border:2px dashed rgba(102,126,234,0.3);text-shadow:0 0 40px rgba(102,126,234,0.5);user-select:all}
        .btn{width:100%;padding:16px;border-radius:16px;border:none;font-size:15px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:.3s;margin-top:8px}
        .btn-copy{background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.1)}
        .btn-copy:hover{background:rgba(255,255,255,0.15)}
        .steps{background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin-top:20px}
        .step{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,0.7);font-size:13px;padding:6px 0}
        .step-num{width:22px;height:22px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
        .status{text-align:center;color:rgba(255,255,255,0.7);font-size:14px;margin-top:16px}
        .status.success{color:#51cf66}
        .status.error{color:#ff6b6b}
        .session-id{font-family:'Space Grotesk',monospace;font-size:14px;color:#f093fb;margin-top:12px;word-break:break-all}
        .spinner{display:inline-block;width:20px;height:20px;border:2px solid rgba(255,255,255,0.2);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px}
        @keyframes spin{to{transform:rotate(360deg)}}
    </style>
</head>
<body>
    <div class="bg"></div>
    <div class="flags" id="flags"></div>
    <div class="card">
        <div class="logo">🇻🇦 TARAGON SQUAD TRS</div>
        <div class="subtitle">Session Generator – Pair Your Number</div>
        <div class="code-box">
            <div class="code-label">Your 8-Digit Pairing Code</div>
            <div class="code" id="code">--------</div>
        </div>
        <button class="btn btn-copy" onclick="copyCode()">📋 Copy Code</button>
        <div class="steps">
            <div class="step"><span class="step-num">1</span> Open WhatsApp on your phone</div>
            <div class="step"><span class="step-num">2</span> Tap ⋮ → <strong>Linked Devices</strong></div>
            <div class="step"><span class="step-num">3</span> Tap <strong>Link a Device</strong></div>
            <div class="step"><span class="step-num">4</span> Enter the code shown above</div>
        </div>
        <p class="status" id="status">Waiting for pairing code...</p>
        <div class="session-id" id="sessionId"></div>
    </div>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const flagsEl=document.getElementById('flags');
        for(let i=0;i<60;i++){
            const f=document.createElement('div');f.className='flag';
            f.textContent='🇻🇦';f.style.left=Math.random()*100+'%';
            f.style.animationDuration=(Math.random()*10+8)+'s';
            f.style.animationDelay=Math.random()*8+'s';
            f.style.fontSize=(Math.random()*20+16)+'px';
            flagsEl.appendChild(f);
        }
        const socket=io();let currentCode='';
        socket.on('code',(data)=>{
            document.getElementById('code').textContent=data.code;
            currentCode=data.code;
            document.getElementById('status').innerHTML='<span class="success">✅ Code ready! Enter it in WhatsApp.</span>';
        });
        socket.on('sessionReady',(data)=>{
            document.getElementById('status').innerHTML='<span class="success">✅ Session saved! Check your WhatsApp for the session ID.</span>';
            document.getElementById('code').textContent='✅ LINKED';
            document.getElementById('sessionId').textContent='Session ID: ' + data.sessionId;
            currentCode='';
        });
        socket.on('codeExpired',()=>{
            document.getElementById('status').innerHTML='<span class="error">⏰ Code expired. Refresh page for a new one.</span>';
        });
        function copyCode(){
            if(!currentCode)return;
            navigator.clipboard.writeText(currentCode).then(()=>{
                const btn=document.querySelector('.btn-copy');
                btn.textContent='✅ Copied!';setTimeout(()=>btn.textContent='📋 Copy Code',2000);
            });
        }
    </script>
</body>
</html>`;

// Now it works because 'public' folder exists
fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);

// Main pairing logic
async function startPairing() {
    console.log('📱 Generating pairing code for', OWNER_PHONE);
    try {
        // Generate a unique session ID
        const sessionId = 'trs-' + crypto.randomBytes(6).toString('hex'); // 16 chars
        const sessionDir = path.join(SESSIONS_DIR, sessionId);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Chrome'),
            markOnlineOnConnect: false,
        });

        const code = await sock.requestPairingCode(OWNER_PHONE);
        console.log(`🔑 Pairing code: ${code}`);
        io.emit('code', { code });

        let connected = false;
        const timeout = setTimeout(() => {
            if (!connected) {
                console.log('⏰ Code expired');
                io.emit('codeExpired');
                fs.rmSync(sessionDir, { recursive: true, force: true }); // clean up
                process.exit(1);
            }
        }, 120000);

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open' && !connected) {
                connected = true;
                clearTimeout(timeout);
                const botNumber = sock.user.id.split(':')[0];
                console.log(`✅ Connected as +${botNumber}`);

                // Final save
                await saveCreds();

                // Send the session ID to the owner via WhatsApp
                const ownerJid = `${OWNER_PHONE}@s.whatsapp.net`;
                await sock.sendMessage(ownerJid, {
                    text: `🔑 *Your Session ID:* \`${sessionId}\`\n\nPaste this ID into your main bot script to run it. Keep this ID safe!`
                }).catch(() => {});

                console.log(`📨 Session ID sent to +${OWNER_PHONE}: ${sessionId}`);
                io.emit('sessionReady', { sessionId });
                console.log(`🎉 Session stored in: ${sessionDir}`);
                console.log(`🔑 Session ID: ${sessionId}`);
                console.log('You can now close this generator and use the ID in your main bot.');

                // Disconnect the temporary socket
                sock.end();
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error('Pairing error:', err.message);
        process.exit(1);
    }
}

server.listen(PORT, () => {
    console.log(`🌐 Web panel: http://localhost:${PORT}`);
    startPairing();
});
