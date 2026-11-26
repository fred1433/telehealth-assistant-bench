// Local stand-ins for the outside world: an SMTP sink and an FCM HTTP v1 sink.
// Every message is appended to a JSONL file that the probes read after each evaluation.
import net from 'node:net';
import http from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';
import { FILES, GRADE_DIR, PORTS } from './config.ts';

mkdirSync(GRADE_DIR, { recursive: true });

const smtp = net.createServer((sock) => {
  let buf = '';
  let inData = false;
  let from = '';
  let to: string[] = [];
  let data = '';
  sock.write('220 collector ESMTP\r\n');
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    while (true) {
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end === -1) {
          return;
        }
        data += buf.slice(0, end);
        data = data.replace(/^\.\./, '.').replace(/\r\n\.\./g, '\r\n.'); // SMTP dot-unstuffing
        buf = buf.slice(end + 5);
        inData = false;
        appendFileSync(FILES.smtp, JSON.stringify({ ts: new Date().toISOString(), from, to, data }) + '\n');
        from = '';
        to = [];
        data = '';
        sock.write('250 queued\r\n');
        continue;
      }
      const nl = buf.indexOf('\r\n');
      if (nl === -1) return;
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-collector\r\n250 8BITMIME\r\n');
      else if (cmd === 'MAIL') { from = line.slice(10).trim(); sock.write('250 ok\r\n'); }
      else if (cmd === 'RCPT') { to.push(line.slice(8).trim().replace(/[<>]/g, '')); sock.write('250 ok\r\n'); }
      else if (cmd === 'DATA') { inData = true; data = ''; sock.write('354 go ahead\r\n'); }
      else if (cmd === 'QUIT') { sock.end('221 bye\r\n'); return; }
      else sock.write('250 ok\r\n');
    }
  });
  sock.on('error', () => {});
});
smtp.listen(PORTS.smtp, '127.0.0.1');

const fcm = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    appendFileSync(FILES.fcm, JSON.stringify({ ts: new Date().toISOString(), method: req.method, path: req.url, body }) + '\n');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ name: `projects/collector/messages/${Date.now()}` }));
  });
});
fcm.listen(PORTS.fcm, '127.0.0.1');
console.log(`collectors up: smtp ${PORTS.smtp}, fcm ${PORTS.fcm}`);
