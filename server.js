// Chùa Bạch Vân - máy chủ: phục vụ trang game và kênh WebSocket cho nhiều người chơi
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');
const ROOM_CAP = parseInt(process.env.ROOM_CAP || '80', 10); // số người tối đa mỗi chánh điện
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.glb': 'model/gltf-binary' };

/* ---------- trang tĩnh ---------- */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  let file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) file = path.join(PUBLIC, 'index.html');
    fs.readFile(file, (e2, buf) => {
      if (e2) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
      res.end(buf);
    });
  });
});

/* ---------- bảng xếp hạng (lưu file) ---------- */
let board = {}; // uid -> {n, cd, sc, t}
try { board = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8')) || {}; } catch (e) { board = {}; }
let boardDirty = false;
setInterval(() => {
  if (!boardDirty) return; boardDirty = false;
  fs.mkdir(DATA_DIR, { recursive: true }, () => fs.writeFile(BOARD_FILE, JSON.stringify(board), () => {}));
}, 10000);
function topFor(uid) {
  return Object.entries(board).sort((a, b) => b[1].cd - a[1].cd).slice(0, 30)
    .map(([k, v]) => ({ n: v.n, cd: Math.floor(v.cd), sc: v.sc, me: k === uid }));
}

/* ---------- phòng chơi ---------- */
const rooms = new Map(); // tên phòng -> Set<client>
function pickRoom() {
  let i = 1;
  for (;;) { const name = 'Chánh điện ' + i; const r = rooms.get(name); if (!r || r.size < ROOM_CAP) { if (!r) rooms.set(name, new Set()); return name; } i++; }
}
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function toRoom(c, msg) { for (const o of rooms.get(c.room) || []) if (o !== c) send(o, msg); }

/* ---------- trò chuyện ---------- */
const STICKERS = ['sen','phapluan','chaptay','trang','chuong','huong','nen','bode','mo','phat','adida','tuyhy','lanhthay'];
const BAD = ['địt','đụ','lồn','cặc','buồi','đéo','đĩ','đmm','đcm','vcl','vkl','clm','fuck','shit','bitch'];
const badRe = new RegExp('(^|[^\\p{L}])(' + BAD.join('|') + ')(?=$|[^\\p{L}])', 'giu');
const maskBad = t => t.replace(badRe, (m, pre, w) => pre + '*'.repeat(w.length));
const history = new Map(); // phòng -> 40 tin gần nhất

const clean = s => (typeof s === 'string' ? s : '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿<>]/g, '').trim().slice(0, 16);
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
function cleanPresence(p) {
  if (!p || typeof p !== 'object') return null;
  return { n: clean(p.n) || 'Khách hành hương', j: num(p.j, 0, 1e7), l: p.l ? 1 : 0, lk: (typeof p.lk === 'string' ? p.lk : '').slice(0, 24), m: p.m ? 1 : 0,
    x: num(p.x, -30, 30), z: num(p.z, -30, 40), r: num(p.r, -20, 20), s: Math.round(num(p.s, -1, 7)), p: p.p ? 1 : 0,
    b: num(p.b, 0, 1e7), bell: num(p.bell, 0, 1e7), mo: num(p.mo, 0, 1e7), inc: num(p.inc, 0, 1e7) };
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', ws => {
  const c = { ws, id: crypto.randomBytes(5).toString('hex'), room: pickRoom(), p: null, uid: null, tick: Date.now(), count: 0, lastChat: 0 };
  rooms.get(c.room).add(c);
  const peers = [...rooms.get(c.room)].filter(o => o !== c && o.p).map(o => ({ id: o.id, p: o.p }));
  send(c, { t: 'welcome', id: c.id, room: c.room, peers, online: wss.clients.size, chat: history.get(c.room) || [] });
  ws.on('message', raw => {
    const now = Date.now(); if (now - c.tick > 1000) { c.tick = now; c.count = 0; } if (++c.count > 40) return; // chống spam
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'p') { const p = cleanPresence(m.p); if (!p) return; c.p = p; toRoom(c, { t: 'p', id: c.id, p }); }
    else if (m.t === 'score') {
      const uid = typeof m.uid === 'string' && /^[a-z0-9]{16,40}$/.test(m.uid) ? m.uid : null; if (!uid) return; c.uid = uid;
      const cd = num(m.cd, -1e9, 1e9); // công đức có thể âm
      board[uid] = { n: clean(m.n) || 'Khách hành hương', cd, sc: (typeof m.sc === 'string' ? m.sc : '').slice(0, 12), t: now }; boardDirty = true;
    }
    else if (m.t === 'chat') {
      if (now - c.lastChat < 1200) return send(c, { t: 'notice', text: 'Bạn gửi hơi nhanh, chậm lại một chút nhé.' });
      const msg = { t: 'chat', id: c.id, n: (c.p && c.p.n) || clean(m.n) || 'Khách hành hương', ts: now };
      if (typeof m.st === 'string' && STICKERS.includes(m.st)) msg.st = m.st;
      else if (typeof m.text === 'string') {
        const text = m.text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim().slice(0, 200);
        if (!text) return; msg.text = maskBad(text);
      } else return;
      c.lastChat = now;
      const h = history.get(c.room) || []; h.push(msg); if (h.length > 40) h.shift(); history.set(c.room, h);
      for (const o of rooms.get(c.room) || []) send(o, msg);
    }
    else if (m.t === 'board') { send(c, { t: 'board', list: topFor(c.uid) }); }
  });
  ws.on('close', () => { const r = rooms.get(c.room); if (r) { r.delete(c); toRoom(c, { t: 'leave', id: c.id }); if (!r.size && c.room !== 'Chánh điện 1') rooms.delete(c.room); } });
});
// gửi bảng xếp hạng và số người online định kỳ
setInterval(() => { for (const r of rooms.values()) for (const c of r) send(c, { t: 'board', list: topFor(c.uid), online: wss.clients.size }); }, 15000);
// giữ kết nối sống qua proxy
setInterval(() => { for (const ws of wss.clients) { try { ws.ping(); } catch (e) {} } }, 25000);

server.listen(PORT, () => console.log('Chùa Bạch Vân đang chạy ở cổng ' + PORT));
