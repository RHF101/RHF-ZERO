// ============================================================
// RHF ZERO — api/export.js
// Export Chat: TXT / JSON / PDF / HTML
// ============================================================

import { getMessages } from './memory.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uid, chatId, format } = req.body;

  if (!uid || !chatId) {
    return res.status(400).json({ error: 'UID dan chatId diperlukan' });
  }

  try {
    const result = await getMessages(uid, chatId, 500);
    if (!result.success || !result.messages.length) {
      return res.status(404).json({ error: 'Chat kosong atau tidak ditemukan' });
    }

    const messages = result.messages;
    const firstUserMsg = messages.find(m => m.role === 'user');
    const chatName = firstUserMsg ? firstUserMsg.content.substring(0, 50).replace(/\n/g, ' ') : 'Chat';

    switch (format) {
      case 'txt':
        return exportTXT(res, messages, chatName);
      case 'json':
        return exportJSON(res, messages, chatName);
      case 'pdf':
      case 'html':
        return exportHTML(res, messages, chatName);
      default:
        return res.status(400).json({ error: 'Format tidak dikenal. Gunakan: txt, json, pdf, html' });
    }
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================
// EXPORT TXT
// ============================================================
function exportTXT(res, messages, chatName) {
  let txt = '';
  txt += 'RHF ZERO — Chat Export\n';
  txt += 'Nama Chat: ' + chatName + '\n';
  txt += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  txt += 'Total Pesan: ' + messages.length + '\n';
  txt += '==================================================\n\n';

  messages.forEach((m, i) => {
    const role = m.role === 'user' ? 'ANDA' : 'RHF ZERO';
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString('id-ID') : '-';
    txt += '[' + (i + 1) + '] ' + role + ' — ' + time + '\n';
    txt += '----------------------------------------\n';
    txt += m.content + '\n\n';
  });

  txt += '==================================================\n';
  txt += 'Diekspor dari RHF ZERO\n';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rhf-zero-' + sanitize(chatName) + '.txt"');
  res.send(txt);
}

// ============================================================
// EXPORT JSON
// ============================================================
function exportJSON(res, messages, chatName) {
  const data = {
    exportedAt: new Date().toISOString(),
    chatName: chatName,
    totalMessages: messages.length,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      mode: m.mode || 'santai',
      timestamp: m.timestamp,
    })),
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rhf-zero-' + sanitize(chatName) + '.json"');
  res.json(data);
}

// ============================================================
// EXPORT PDF / HTML
// ============================================================
function exportHTML(res, messages, chatName) {
  let html = '<!DOCTYPE html>\n<html>\n<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <title>RHF ZERO — ' + escapeHTML(chatName) + '</title>\n';
  html += '  <style>\n';
  html += '    * { margin: 0; padding: 0; box-sizing: border-box; }\n';
  html += '    body { font-family: Arial, sans-serif; padding: 30px; max-width: 750px; margin: auto; color: #1a1a1a; background: #fff; }\n';
  html += '    h1 { font-size: 22px; margin-bottom: 4px; color: #6c5ce7; }\n';
  html += '    .meta { color: #888; font-size: 12px; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }\n';
  html += '    .msg { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #f0f0f0; }\n';
  html += '    .role { font-weight: 700; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }\n';
  html += '    .role.user { color: #6c5ce7; }\n';
  html += '    .role.ai { color: #333; }\n';
  html += '    .content { font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }\n';
  html += '    .content pre { background: #f7f7f7; padding: 10px; border-radius: 6px; font-size: 11px; overflow-x: auto; border: 1px solid #e0e0e0; }\n';
  html += '    .content code { font-family: "Courier New", monospace; font-size: 11px; }\n';
  html += '    .footer { margin-top: 30px; font-size: 10px; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }\n';
  html += '    @media print { body { padding: 20px; } .msg { page-break-inside: avoid; } }\n';
  html += '  </style>\n';
  html += '</head>\n<body>\n\n';

  html += '  <h1>' + escapeHTML(chatName) + '</h1>\n';
  html += '  <div class="meta">Diekspor: ' + new Date().toLocaleString('id-ID') + ' &nbsp;|&nbsp; ' + messages.length + ' pesan</div>\n\n';

  messages.forEach(m => {
    const roleClass = m.role === 'user' ? 'user' : 'ai';
    const roleName = m.role === 'user' ? 'ANDA' : 'RHF ZERO';
    const content = formatContentForHTML(m.content);

    html += '  <div class="msg">\n';
    html += '    <div class="role ' + roleClass + '">' + roleName + '</div>\n';
    html += '    <div class="content">' + content + '</div>\n';
    html += '  </div>\n\n';
  });

  html += '  <div class="footer">Diekspor dari RHF ZERO</div>\n';
  html += '</body>\n</html>\n';

  const filename = 'rhf-zero-' + sanitize(chatName) + '.html';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send(html);
}

// ============================================================
// HELPERS
// ============================================================
function sanitize(str) {
  return (str || 'chat')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\uac00-\ud7af\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30) || 'chat';
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatContentForHTML(content) {
  if (!content) return '';

  // Jika ada code block, pertahankan format
  if (content.includes('```')) {
    return content
      .replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
        const escaped = escapeHTML(code);
        return '<pre><code>' + escaped + '</code></pre>';
      })
      .replace(/\n/g, '<br>');
  }

  return escapeHTML(content).replace(/\n/g, '<br>');
}
