const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const Parser = require("rss-parser");

const parser = new Parser();
const MEDIUM_BASE_URL = "https://medium.com/@lornanaula0042";

// Extract username from URL or return as-is
function extractUsername(input) {
  if (input.startsWith("http")) {
    const url = input.split("?")[0].replace(/\/$/, "");
    const match = url.match(/@([\w\-]+)/);
    if (match) return match[1];
    throw new Error("Invalid Medium profile URL. Could not extract username.");
  }
  return input;
}

// Fetch articles from RSS feed
async function fetchArticlesFromRSS(username) {
  try {
    const feedUrl = `https://medium.com/feed/@${username}`;
    const feed = await parser.parseURL(feedUrl);

    // Map RSS items to a structured array
    const articles = feed.items.map(item => ({
      title: item.title,
      link: item.link,
      preview: item.contentSnippet,
    }));

    return articles;
  } catch (error) {
    console.error("Error fetching RSS feed:", error.message);
    return [];
  }
}

// Fetch full content of an article using axios + cheerio
async function fetchArticleContent(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    const $ = cheerio.load(data);
    let content = "";
    $("article p").each((i, elem) => {
      content += $(elem).text() + "\n";
    });

    return content.trim();
  } catch (error) {
    console.error(`Error fetching article content from ${url}:`, error.message);
    return "";
  }
}

// Crawl Medium user via RSS
async function crawlMediumUser(input) {
  const username = extractUsername(input);
  const articles = await fetchArticlesFromRSS(username);

  for (let i = 0; i < articles.length; i++) {
    articles[i].fullContent = await fetchArticleContent(articles[i].link);
  }

  return { username, articles };
}

// === MAIN ===
(async () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log("Usage: node advancedCrawler.js <medium_username_or_profile_url>");
    process.exit(1);
  }

  const input = args[0];
  const { username, articles } = await crawlMediumUser(input);

  console.log(`Found ${articles.length} articles for @${username}\n`);
  articles.forEach((a, i) => {
    console.log(`[${i + 1}] ${a.title}`);
    console.log(`Link: ${a.link}`);
    console.log(`Preview: ${a.preview}`);
    console.log(`Full content snippet: ${a.fullContent.slice(0, 200)}...\n`);
  });

  const filename = `${username}_articles.json`;
  fs.writeFileSync(filename, JSON.stringify(articles, null, 2));
  console.log(`All articles saved to ${filename}`);
})();
