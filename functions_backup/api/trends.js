// functions/api/trends.js — Scraper de Trending Topics do X no Brasil (Trends24)

export async function onRequestGet() {
  try {
    const res = await fetch('https://trends24.in/brazil/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch Trends24' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const html = await res.text();
    const parts = html.split(/class=["']?list-container["']?/i);
    const timeBlocks = [];
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const titleMatch = part.match(/<h3[^>]*class=["']?title["']?[^>]*>(.*?)<\/h3>/i);
      if (!titleMatch) continue;
      
      const title = titleMatch[1].trim();
      const trendRegex = /<a[^>]*class=["']?trend-link["']?[^>]*>(.*?)<\/a>/gi;
      const trends = [];
      let match;
      let rank = 1;
      
      while ((match = trendRegex.exec(part)) !== null) {
        trends.push({
          rank: rank++,
          name: match[1].trim()
        });
      }
      
      if (trends.length > 0) {
        timeBlocks.push({
          time: title,
          trends: trends
        });
      }
    }

    return new Response(JSON.stringify({ timeBlocks }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=utf-8' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
