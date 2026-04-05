export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=86400');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  try {
    const url = 'https://www.googleapis.com/books/v1/volumes?q='
      + encodeURIComponent(q)
      + '&maxResults=1&printType=books&orderBy=relevance';

    const r = await fetch(url);
    const d = await r.json();
    const item = d.items?.[0];

    if (!item) return res.status(200).json({ found: false });

    const info = item.volumeInfo;
    const links = info.imageLinks || {};
    const cover = links.large || links.medium || links.thumbnail || links.smallThumbnail || null;

    res.status(200).json({
      found: true,
      title: info.title || q,
      authors: info.authors || [],
      cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
      year: info.publishedDate ? info.publishedDate.substring(0, 4) : null,
      description: info.description ? info.description.substring(0, 200) : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
