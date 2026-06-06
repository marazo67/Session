// session_generator.js – Fully working with user phone input
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// Frontend HTML with phone input + socket.emit()
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
.card{position:relative;z-index:10;background:rgba(255,255,255,0.03);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px;max-width:500px;width:92%;box-shadow:0 25px 50px rgba(0,0,0,0.5)}
.logo{font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;text-align:center;background:linear-gradient(135deg,#667eea,#764ba2,#f093fb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.subtitle{text-align:center;color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:24px}
.input-group{margin:20px 0;text-align:left}
.input-group label{color:rgba(255,255,255,0.7);font-size:13px;margin-bottom:8px;display:block}
.phone-input{width:100%;padding:14px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;font-size:16px;font-family:'Inter',monospace;text-align:center}
.phone-input:focus{outline:none;border-color:#667eea}
.code-box{text-align:center;margin:24px 0}
.code-label{color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.code{font-family:'Space Grotesk',monospace;font-size:48px;font-weight:700;letter-spacing:14px;color:#667eea;padding:24px 16px;background:rgba(102,126,234,0.08);border-radius:16px;border:2px dashed rgba(102,126,234,0.3);text-shadow:0 0 40px rgba(102,126,234,0.5);user-select:all;min-height:100px;display:flex;align-items:center;justify-content:center}
.btn{width:100%;padding:16px;border-radius:16px;border:none;font-size:15px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:.3s;margin-top:8px}
.btn-gen{background:linear-gradient(135deg,#667eea,#764ba2);color:white}
.btn-gen:hover{transform:translateY(-2px)}
.btn-gen:disabled{opacity:0.5;cursor:not-allowed;transform:none}
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
<div class="card">
<div class="logo">🇻🇦 TARAGON SQUAD TRS</div>
<div class="subtitle">Session Generator – Pair Your Number</div>

<div class="input-group">
<label>📱 Your WhatsApp Number (international, no +)</label>
<input type="tel" id="phone" class="phone-input" placeholder="e.g. 27785028986" value="">
</div>

<div class="code-box">
<div class="code-label">Your 8-Digit Pairing Code</div>
<div class="code" id="code">---</div>
</div>

<button class="btn btn-gen" id="genBtn">🔑 Generate Pairing Code</button>
<button class="btn btn-copy" id="copyBtn" style="display:none">📋 Copy Code</button>

<div class="steps">
<div class="step"><span class="step-num">1</span> Open WhatsApp on your phone</div>
<div class="step"><span class="step-num">2</span> Tap ⋮ → <strong>Linked Devices</strong></div>
<div class="step"><span class="step-num">3</span> Tap <strong>Link a Device</strong></div>
<div class="step"><span class="step-num">4</span> Enter the code shown above</div>
</div>

<p class="status" id="status">Enter your phone number and generate code</p>
<div class="session-id" id="sessionId"></div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let currentCode = '';
let generating = false;

const genBtn = document.getElementById('genBtn');
const copyBtn = document.getElementById('copyBtn');
const codeDiv = document.getElementById('code');
const statusDiv = document.getElementById('status');
const sessionIdDiv = document.getElementById('sessionId');
const phoneInput = document.getElementById('phone');

genBtn.addEventListener('click', () => {
    let phone = phoneInput.value.trim();
    if (!phone) {
        statusDiv.innerHTML = '<span class="error">❌ Please enter your phone number</span>';
        return;
    }
    // remove all non-digits
    phone = phone.replace(/\\D/g, '');
    if (phone.length < 10) {
        statusDiv.innerHTML = '<span class="error">❌ Invalid number – include country code (e.g. 2778...)</span>';
        return;
    }
    if (generating) return;
    generating = true;
    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
    statusDiv.innerHTML = '<span class="spinner"></span>Requesting code for +' + phone + '...';
    copyBtn.style.display = 'none';
    codeDiv.textContent = '⏳ ...';
    sessionIdDiv.textContent = '';
    socket.emit('generate', { phoneNumber: phone });
});

socket.on('code', (data) => {
    codeDiv.textContent = data.code;
    currentCode = data.code;
    statusDiv.innerHTML = '<span class="success">✅ Code ready! Enter it in WhatsApp within 2 minutes</span>';
    copyBtn.style.display = 'block';
    genBtn.style.display = 'none';
});

socket.on('sessionReady', (data) => {
    statusDiv.innerHTML = '<span class="success">✅ Linked! Session ID sent to your WhatsApp</span>';
    codeDiv.textContent = '✅ LINKED';
    sessionIdDiv.textContent = 'Session ID: ' + data.sessionId;
    currentCode = '';
    resetUiAfterPairing();
});

socket.on('codeExpired', () => {
    statusDiv.innerHTML = '<span class="error">⏰ Code expired. Click Generate again</span>';
    codeDiv.textContent = 'EXPIRED';
    resetBtn();
});

socket.on('error', (msg) => {
    statusDiv.innerHTML = '<span class="error">❌ ' + msg + '</span>';
    resetBtn();
});

function resetBtn() {
    generating = false;
    genBtn.disabled = false;
    genBtn.textContent = '🔑 Generate Pairing Code';
    genBtn.style.display = 'block';
    copyBtn.style.display = 'none';
}

function resetUiAfterPairing() {
    generating = false;
    genBtn.disabled = false;
    genBtn.textContent = '🔑 Generate Pairing Code';
    genBtn.style.display = 'block';
    copyBtn.style.display = 'none';
    phoneInput.value = '';
}

function copyCode() {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode).then(() => {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => copyBtn.textContent = '📋 Copy Code', 2000);
    });
}
copyBtn.onclick = copyCode;
</script>
</body>
</html>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);

// ------------------- PAIRING LOGIC (per socket) -------------------
// Each client's 'generate' event starts an independent pairing flow
io.on('connection', (socket) => {
    console.log(`🟢 Client connected: ${socket.id}`);

    socket.on('generate', async (data) => {
        let { phoneNumber } = data;
        if (!phoneNumber) {
            socket.emit('error', 'Phone number missing');
            return;
        }
        // sanitize: only digits
        phoneNumber = phoneNumber.replace(/\D/g, '');
        if (phoneNumber.length < 10) {
            socket.emit('error', 'Invalid phone number (need country code, e.g. 2778...)');
            return;
        }

        // Create unique session folder for this pairing attempt
        const sessionId = `trs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const sessionDir = path.join(SESSIONS_DIR, sessionId);
        fs.mkdirSync(sessionDir, { recursive: true });

        let sock = null;
        let codeTimer = null;
        let isPaired = false;

        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            const { version } = await fetchLatestBaileysVersion();

            sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
                },
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS('Chrome'),
                markOnlineOnConnect: false,
                keepAliveIntervalMs: 10000
            });

            // Request pairing code for the user's number
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`🔑 Pairing code for ${phoneNumber}: ${code}`);
            socket.emit('code', { code });

            // Set expiry: 2 minutes
            codeTimer = setTimeout(() => {
                if (!isPaired) {
                    console.log(`⏰ Code expired for ${phoneNumber}`);
                    socket.emit('codeExpired');
                    cleanup();
                }
            }, 120000);

            // Listen for connection success
            sock.ev.on('connection.update', async (update) => {
                const { connection } = update;
                if (connection === 'open' && !isPaired) {
                    isPaired = true;
                    clearTimeout(codeTimer);

                    const botJid = sock.user.id.split(':')[0];
                    console.log(`✅ Paired +${botJid} with session ${sessionId}`);

                    await saveCreds();

                    // Send session ID to the user's own WhatsApp number
                    const userJid = `${phoneNumber}@s.whatsapp.net`;
                    await sock.sendMessage(userJid, {
                        text: `🔐 *Your Taragon Bot Session ID*\n\n\`${sessionId}\`\n\nSave this ID and use it in the main bot configuration.\n\n⚠️ Never share it with anyone.`
                    }).catch(err => console.error('Failed to send session message:', err));

                    socket.emit('sessionReady', { sessionId });

                    // Close the connection gracefully after a short delay
                    setTimeout(() => sock?.end(), 2000);
                }
            });

            sock.ev.on('creds.update', saveCreds);

            // Error handling
            sock.ev.on('connection.update', (update) => {
                if (update.lastDisconnect?.error) {
                    console.error('Connection error:', update.lastDisconnect.error);
                    if (!isPaired) {
                        socket.emit('error', 'Pairing failed: ' + update.lastDisconnect.error.message);
                        cleanup();
                    }
                }
            });

        } catch (err) {
            console.error('Pairing init error:', err);
            socket.emit('error', err.message || 'Unable to start pairing');
            cleanup();
        }

        function cleanup() {
            if (codeTimer) clearTimeout(codeTimer);
            if (sock && !isPaired) sock.end();
            // delete session folder only if not paired
            if (!isPaired) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔴 Client disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => console.log(`🌐 Web panel running on http://localhost:${PORT}`));
