// session_generator.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const OWNER_PHONE = '27785028986'; // digits only
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

// Frontend
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
<div class="code-box">
<div class="code-label">Your 8-Digit Pairing Code</div>
<div class="code" id="code">Click Generate</div>
</div>
<button class="btn btn-gen" id="genBtn" onclick="generateCode()">🔑 Generate Pairing Code</button>
<button class="btn btn-copy" id="copyBtn" onclick="copyCode()" style="display:none">📋 Copy Code</button>
<div class="steps">
<div class="step"><span class="step-num">1</span> Open WhatsApp on your phone</div>
<div class="step"><span class="step-num">2</span> Tap ⋮ → <strong>Linked Devices</strong></div>
<div class="step"><span class="step-num">3</span> Tap <strong>Link a Device</strong></div>
<div class="step"><span class="step-num">4</span> Enter the code shown above</div>
</div>
<p class="status" id="status">Ready to generate</p>
<div class="session-id" id="sessionId"></div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
const socket=io();let currentCode='';let generating=false;

async function generateCode(){
if(generating)return;generating=true;
const btn=document.getElementById('genBtn');
btn.disabled=true;btn.textContent='Generating...';
document.getElementById('status').innerHTML='<span class="spinner"></span>Requesting code...';
document.getElementById('copyBtn').style.display='none';
await fetch('/generate',{method:'POST'});
}

socket.on('code',(data)=>{
document.getElementById('code').textContent=data.code;
currentCode=data.code;
document.getElementById('status').innerHTML='<span class="success">✅ Code ready! Enter in WhatsApp within 2min</span>';
document.getElementById('copyBtn').style.display='block';
document.getElementById('genBtn').style.display='none';
});

socket.on('sessionReady',(data)=>{
document.getElementById('status').innerHTML='<span class="success">✅ Linked! Session saved & sent to your WhatsApp</span>';
document.getElementById('code').textContent='✅ LINKED';
document.getElementById('sessionId').textContent='Session ID: '+data.sessionId;
currentCode='';
});

socket.on('codeExpired',()=>{
document.getElementById('status').innerHTML='<span class="error">⏰ Code expired. Click Generate again</span>';
document.getElementById('code').textContent='EXPIRED';
resetBtn();
});

socket.on('error',(msg)=>{
document.getElementById('status').innerHTML='<span class="error">❌ '+msg+'</span>';
resetBtn();
});

function resetBtn(){
generating=false;
document.getElementById('genBtn').disabled=false;
document.getElementById('genBtn').textContent='🔑 Generate Pairing Code';
document.getElementById('genBtn').style.display='block';
}

function copyCode(){
if(!currentCode)return;
navigator.clipboard.writeText(currentCode).then(()=>{
const btn=document.getElementById('copyBtn');
btn.textContent='✅ Copied!';
setTimeout(()=>btn.textContent='📋 Copy Code',2000);
});
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);

// Pairing logic
async function startPairing(){
const sessionId='trs-'+crypto.randomBytes(6).toString('hex');
const sessionDir=path.join(SESSIONS_DIR,sessionId);
if(!fs.existsSync(sessionDir))fs.mkdirSync(sessionDir,{recursive:true});

const {state,saveCreds}=await useMultiFileAuthState(sessionDir);
const {version}=await fetchLatestBaileysVersion();

const sock=makeWASocket({
version,
auth:{creds:state.creds,keys:makeCacheableSignalKeyStore(state.keys,pino({level:'silent'}))},
printQRInTerminal:false,
logger:pino({level:'silent'}),
browser:Browsers.macOS('Chrome'),
markOnlineOnConnect:false,
keepAliveIntervalMs:10000, // keeps Render socket alive
});

try{
const code=await sock.requestPairingCode(OWNER_PHONE);
console.log(`🔑 Pairing code: ${code}`);
io.emit('code',{code});
}catch(e){
console.error('Pairing error:',e.message);
io.emit('error',e.message);
return;
}

let connected=false;
const timeout=setTimeout(()=>{
if(!connected){
console.log('⏰ Code expired');
io.emit('codeExpired');
fs.rmSync(sessionDir,{recursive:true,force:true});
}
},120000);

sock.ev.on('connection.update',async(update)=>{
const{connection}=update;
if(connection==='open'&&!connected){
connected=true;clearTimeout(timeout);
const botNumber=sock.user.id.split(':')[0];
console.log(`✅ Connected as +${botNumber}`);
await saveCreds();
const ownerJid=`${OWNER_PHONE}@s.whatsapp.net`;
await sock.sendMessage(ownerJid,{text:`🔑 *Your Session ID:* \`${sessionId}\`\n\nPaste this into your main bot. Keep it safe!`}).catch(()=>{});
io.emit('sessionReady',{sessionId});
console.log(`🎉 Session stored: ${sessionDir}`);
sock.end();
}
});

sock.ev.on('creds.update',saveCreds);
}

// API endpoint
app.post('/generate',async(req,res)=>{
startPairing();
res.json({status:'generating'});
});

server.listen(PORT,()=>console.log(`🌐 Web panel: http://localhost:${PORT}`));
