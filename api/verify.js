export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { books } = req.body;
  if (!books?.length) return res.status(400).json({ results: [] });

  const results = await Promise.all(books.map(async ({ title, author, desc }) => {
    try {
      const q = encodeURIComponent(title + ' ' + author);
      const r = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5&langRestrict=sv`,
      );
      const d = await r.json();

      // Also try without language restriction
      const r2 = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5`,
      );
      const d2 = await r2.json();

      const allItems = [...(d.items || []), ...(d2.items || [])];
      const titleLower = title.toLowerCase().replace(/[^a-z0-9\u00e5\u00e4\u00f6]/g, '');

      let bestCover = null;
      let verified = false;

      for (const item of allItems) {
        const info = item.volumeInfo;
        const foundTitle = (info.title || '').toLowerCase().replace(/[^a-z0-9\u00e5\u00e4\u00f6]/g, '');
        const foundAuthors = (info.authors || []).join(' ').toLowerCase();
        const authorLastName = author.toLowerCase().split(' ').pop();

        const titleMatch = foundTitle.includes(titleLower.substring(0, Math.min(8, titleLower.length)))
          || titleLower.includes(foundTitle.substring(0, Math.min(8, foundTitle.length)));
        const authorMatch = foundAuthors.includes(authorLastName);

        if (titleMatch && authorMatch) {
          verified = true;
          const links = info.imageLinks;
          if (links) {
            const raw = links.large || links.medium || links.thumbnail || links.smallThumbnail;
            if (raw) bestCover = raw.replace('http://', 'https://').replace('&edge=curl', '');
          }
          if (bestCover) break;
        }
      }

      // If no strict match, try Open Library for cover only
      if (!bestCover) {
        try {
          const olQ = encodeURIComponent(title + ' ' + author);
          const olR = await fetch(`https://openlibrary.org/search.json?q=${olQ}&limit=3&fields=cover_i,title,author_name`);
          const olD = await olR.json();
          for (const doc of (olD.docs || [])) {
            if (doc.cover_i) {
              bestCover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
              if (!verified) verified = true;
              break;
            }
          }
        } catch (_) {}
      }

      return { title, author, desc, verified, cover: bestCover };
    } catch (e) {
      return { title, author, desc, verified: true, cover: null };
    }
  }));

  res.status(200).json({ results });
}
