// api/search.js — RHF ZERO v5 Google Search Handler
// POST /api/search  { query, uid }
// Returns: { results: [{ title, link, snippet, source }] }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query diperlukan' });

  // Coba Google Custom Search dulu, fallback ke DuckDuckGo Instant Answer
  let results = await googleSearch(query);
  if (!results || results.length === 0) {
    results = await ddgSearch(query);
  }

  if (!results || results.length === 0) {
    return res.json({ ok: false, results: [], message: 'Tidak ada hasil ditemukan.' });
  }

  return res.json({ ok: true, query, results: results.slice(0, 8) });
}

// ── Google Custom Search API ──
async function googleSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx     = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) return null;

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=8&hl=id`;
    const r   = await fetch(url);
    if (!r.ok) return null;
    const d   = await r.json();
    if (!d.items) return null;
    return d.items.map(item => ({
      title:   item.title || '',
      link:    item.link  || '',
      snippet: item.snippet || '',
      source:  'Google',
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(item.link).hostname}`
    }));
  } catch (e) {
    console.error('[search] Google error:', e.message);
    return null;
  }
}

// ── DuckDuckGo Instant Answer API (fallback, no key needed) ──
async function ddgSearch(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const r   = await fetch(url, { headers: { 'User-Agent': 'RHF-ZERO/5.0' } });
    if (!r.ok) return null;
    const d   = await r.json();

    const results = [];

    // AbstractText (main answer)
    if (d.AbstractText) {
      results.push({
        title:   d.Heading || query,
        link:    d.AbstractURL || '#',
        snippet: d.AbstractText,
        source:  d.AbstractSource || 'DuckDuckGo',
        favicon: ''
      });
    }

    // RelatedTopics
    if (d.RelatedTopics) {
      for (const t of d.RelatedTopics.slice(0, 6)) {
        if (t.Text && t.FirstURL) {
          results.push({
            title:   t.Text.split(' - ')[0] || t.Text.substring(0, 60),
            link:    t.FirstURL,
            snippet: t.Text,
            source:  'DuckDuckGo',
            favicon: ''
          });
        }
      }
    }

    // Answer (kalkulator, dll)
    if (d.Answer) {
      results.unshift({
        title:   'Jawaban Langsung',
        link:    '#',
        snippet: d.Answer,
        source:  'DuckDuckGo Instant',
        favicon: ''
      });
    }

    return results.length > 0 ? results : null;
  } catch (e) {
    console.error('[search] DDG error:', e.message);
    return null;
  }
}
