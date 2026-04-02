export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title' });

  try {
    const q = encodeURIComponent('intitle:' + title + (author ? ' inauthor:' + author : ''));
    const r = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + q + '&maxResults=3&printType=books');
    const d = await r.json();

    let cover = null;
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

    res.status(200).json({ cover });
  } catch (e) {
    res.status(500).json({ error: e.message, cover: null });
  }
}
