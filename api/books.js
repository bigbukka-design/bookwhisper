export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  // 1. Try Libris (Swedish National Library) first - best for Swedish titles
  try {
    const librisUrl = 'https://libris.kb.se/xsearch?query='
      + encodeURIComponent(q)
      + '&format=json&n=3';
    const lr = await fetch(librisUrl);
    const ld = await lr.json();
    const hits = ld.xsearch?.list || [];

    for (const hit of hits) {
      const title = hit.title || '';
      const creator = hit.creator || '';
      if (title && creator) {
        // Get cover from Open Library using ISBN if available
        let cover = null;
        const isbn = hit.identifier?.find(i => i.startsWith('ISBN:'))?.replace('ISBN:', '').trim();
        if (isbn) {
          cover = 'https://covers.openlibrary.org/b/isbn/' + isbn.replace(/-/g,'') + '-M.jpg';
        }
        return res.status(200).json({
          found: true,
          title: title,
          authors: [creator],
          cover: cover,
          source: 'libris'
        });
      }
    }
  } catch (e) {
    console.error('Libris error:', e.message);
  }

  // 2. Fallback: Google Books with Swedish preference
  try {
    const gbUrl = 'https://www.googleapis.com/books/v1/volumes?q='
      + encodeURIComponent(q)
      + '&maxResults=3&langRestrict=sv';
    const gr = await fetch(gbUrl);
    const gd = await gr.json();

    for (const item of (gd.items || [])) {
      const info = item.volumeInfo;
      const links = info.imageLinks || {};
      const cover = links.large || links.medium || links.thumbnail || links.smallThumbnail || null;
      return res.status(200).json({
        found: true,
        title: info.title || q,
        authors: info.authors || [],
        cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
        source: 'google-sv'
      });
    }

    // 3. Google Books without language restriction
    const gr2 = await fetch('https://www.googleapis.com/books/v1/volumes?q='
      + encodeURIComponent(q) + '&maxResults=1');
    const gd2 = await gr2.json();
    const item = gd2.items?.[0];
    if (item) {
      const info = item.volumeInfo;
      const links = info.imageLinks || {};
      const cover = links.large || links.medium || links.thumbnail || links.smallThumbnail || null;
      return res.status(200).json({
        found: true,
        title: info.title || q,
        authors: info.authors || [],
        cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
        source: 'google'
      });
    }
  } catch (e) {
    console.error('Google Books error:', e.message);
  }

  return res.status(200).json({ found: false });
}
