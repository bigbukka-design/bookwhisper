export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { books } = req.body;
  if (!books || !Array.isArray(books)) return res.status(400).json({ error: 'Missing books array' });

  const results = await Promise.all(books.map(async ({ title, author }) => {
    try {
      // Try Google Books with strict title+author match
      const q = encodeURIComponent(`intitle:${title} inauthor:${author}`);
      const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3`);
      const d = await r.json();

      for (const item of (d.items || [])) {
        const info = item.volumeInfo;
        const foundTitle = (info.title || '').toLowerCase();
        const foundAuthors = (info.authors || []).join(' ').toLowerCase();
        const searchTitle = title.toLowerCase();
        const searchAuthor = author.toLowerCase().split(' ').pop(); // last name

        // Check title similarity and author match
        if (
          (foundTitle.includes(searchTitle) || searchTitle.includes(foundTitle.substring(0, 6))) &&
          foundAuthors.includes(searchAuthor)
        ) {
          const links = info.imageLinks;
          const cover = links
            ? (links.thumbnail || links.smallThumbnail || null)
            : null;
          return {
            title,
            author,
            verified: true,
            cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
            publishedDate: info.publishedDate || null,
          };
        }
      }

      // Fallback: just title search if strict match failed
      const q2 = encodeURIComponent(`intitle:${title}`);
      const r2 = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q2}&maxResults=1`);
      const d2 = await r2.json();
      const item2 = d2.items?.[0];
      if (item2) {
        const links = item2.volumeInfo?.imageLinks;
        const cover = links ? (links.thumbnail || links.smallThumbnail || null) : null;
        return {
          title,
          author,
          verified: true,
          cover: cover ? cover.replace('http://', 'https://').replace('&edge=curl', '') : null,
          publishedDate: item2.volumeInfo?.publishedDate || null,
        };
      }

      return { title, author, verified: false, cover: null };
    } catch (e) {
      // If API fails, let it through rather than blocking
      return { title, author, verified: true, cover: null };
    }
  }));

  res.status(200).json({ results });
}
