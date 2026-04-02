export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title' });

  let cover = null;

  // 1. Try Google Books
  try {
    const q = encodeURIComponent('intitle:' + title + (author ? ' inauthor:' + author : ''));
    const r = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + q + '&maxResults=3');
    const d = await r.json();
    for (const item of (d.items || [])) {
      const links = item.volumeInfo?.imageLinks;
      if (links) {
        const raw = links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail;
        if (raw) {
          cover = raw.replace('http://', 'https://').replace('&edge=curl', '');
          break;
        }
      }
    }
  } catch (e) { console.error('Google Books error:', e.message); }

  // 2. Fallback: Open Library
  if (!cover) {
    try {
      const q = encodeURIComponent(title + (author ? ' ' + author : ''));
      const r = await fetch('https://openlibrary.org/search.json?q=' + q + '&limit=3&fields=cover_i,title');
      const d = await r.json();
      for (const doc of (d.docs || [])) {
        if (doc.cover_i) {
          cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
          break;
        }
      }
    } catch (e) { console.error('Open Library error:', e.message); }
  }

  res.status(200).json({ cover, source: cover ? (cover.includes('openlibrary') ? 'openlibrary' : 'google') : null });
}
