export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ books: [] });

  const books = [];

  try {
    // Search Swedish books first
    const svUrl = 'https://www.googleapis.com/books/v1/volumes?q='
      + encodeURIComponent(q)
      + '&maxResults=3&langRestrict=sv&printType=books&orderBy=relevance';
    const svR = await fetch(svUrl);
    const svD = await svR.json();

    for (const item of (svD.items || [])) {
      const info = item.volumeInfo;
      if (!info.title || !info.authors) continue;
      const links = info.imageLinks || {};
      const cover = links.large || links.medium || links.thumbnail || links.smallThumbnail || null;
      books.push({
        title: info.title,
        author: (info.authors || []).join(', '),
        desc: (info.description || '').substring(0, 160).trim(),
        cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
        year: (info.publishedDate || '').substring(0, 4),
        lang: 'sv'
      });
    }

    // If fewer than 2 Swedish results, supplement with any language
    if (books.length < 2) {
      const anyUrl = 'https://www.googleapis.com/books/v1/volumes?q='
        + encodeURIComponent(q)
        + '&maxResults=4&printType=books&orderBy=relevance';
      const anyR = await fetch(anyUrl);
      const anyD = await anyR.json();

      for (const item of (anyD.items || [])) {
        if (books.length >= 3) break;
        const info = item.volumeInfo;
        if (!info.title || !info.authors) continue;
        // Skip if already in list
        if (books.some(b => b.title === info.title)) continue;
        const links = info.imageLinks || {};
        const cover = links.large || links.medium || links.thumbnail || links.smallThumbnail || null;
        books.push({
          title: info.title,
          author: (info.authors || []).join(', '),
          desc: (info.description || '').substring(0, 160).trim(),
          cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
          year: (info.publishedDate || '').substring(0, 4),
          lang: info.language || 'unknown'
        });
      }
    }
  } catch (e) {
    console.error('Search error:', e.message);
  }

  res.status(200).json({ books: books.slice(0, 3) });
}
