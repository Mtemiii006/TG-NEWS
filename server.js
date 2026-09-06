// Server logic unchanged from the uploaded version - only public/index.html
// was redesigned. Routes, WS path, Telegram function, and payload shapes
// are all identical to what index.html already expects.
import express from 'express';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ========== TELEGRAM ==========
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8721690873:AAFscuB_J0ebnBi1vJgukexWJxiEfH17Zn0";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "93372553";

async function sendTelegram(text){
  try{
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML'})
    });
  }catch(e){ console.log("TG err", e.message) }
}

// ========== LIVE DATA ==========
let lastMT5 = { bid: 0, ask: 0, spread: 0, bal: 200, fm: 0, symbol: 'XAUUSDm', online: false, time: null };
let sources = { mt5: 'OFFLINE', ff: 'LIVE', bls: 'LIVE', fred: 'LIVE', twelvedata: 'LIVE', yahoo: 'LIVE', investing: 'LIVE', te: 'LIVE', journal: 'LIVE' };
let cache = { ff: { name: 'USD CPI', fc: '3.1%', prev: '3.2%', time: new Date(Date.now()+14*60000) } };

// MT5 EA pushes here
app.post('/api/mt5/push', (req,res)=>{
  lastMT5 = {...lastMT5, ...req.body, online: true, time: new Date()};
  sources.mt5 = 'LIVE';
  const msg = JSON.stringify({type:'mt5', mt5: lastMT5, sources});
  wss.clients.forEach(c=>{ try{c.send(msg)}catch(e){} });
  res.json({ok:true});
});

app.get('/api/sources/status', (req,res)=>{
  if(lastMT5.time && Date.now() - new Date(lastMT5.time).getTime() > 35000){
    lastMT5.online = false;
    sources.mt5 = 'OFFLINE';
  }
  res.json({sources, mt5: lastMT5, serverTime: new Date()});
});

app.get('/api/live-price', async (req,res)=>{
  if(lastMT5.online && lastMT5.bid>0) return res.json({price:lastMT5.bid, source:'MT5 LIVE', ...lastMT5});
  return res.json({price:4432.9, source:'Yahoo backup', online:false});
});

// 9-source alerts every 5 sec
let last15=0, last5=0, last1=0;
setInterval(()=>{
  const secToNews = Math.floor((cache.ff.time - new Date())/1000); // replace with real FF time
  const now = Date.now();
  if(secToNews<=900 && secToNews>850 && now-last15>60000){ last15=now; sendTelegram(`🔴 <b>HIGH IMPACT IN 15M</b> - ${cache.ff.name}\nPrice: ${lastMT5.bid?.toFixed(2)||'--'} ${lastMT5.online?'MT5 LIVE':'OFFLINE'}\nBAL $${lastMT5.bal}\nLink: https://${req?.headers?.host||'your-site.up.railway.app'}`); }
  if(secToNews<=300 && secToNews>250 && now-last5>60000){ last5=now; sendTelegram(`⚠️ 5M to ${cache.ff.name} - XAUUSDm ${lastMT5.bid} Spread ${lastMT5.spread}`); }
  if(secToNews<=70 && secToNews>50 && now-last1>60000){ last1=now; sendTelegram(`🚀 1M - ENTRY 4432-4433 SL 4436.5 AGG 75% SAFE 88%`); }
},5000);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, ()=> console.log(`TG News LIVE on ${PORT}`));
const wss = new WebSocketServer({server, path:'/ws/live'});
wss.on('connection', ws=>{ ws.send(JSON.stringify({type:'init', mt5:lastMT5, sources})); });