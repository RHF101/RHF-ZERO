// ============================================================
// RHF ZERO — api/export.js
// Export Chat: TXT
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
    const chatName = messages.find(m => m.role === 'user')?.content?.substring(0, 50) || 'Chat';

    if (format === 'txt') {
      let txt = 'RHF ZERO — Chat Export\n';
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
      return res.send(txt);
    }

    return res.status(400).json({ error: 'Format belum didukung' });
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

function sanitize(str) {
  return (str || 'chat').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
}
