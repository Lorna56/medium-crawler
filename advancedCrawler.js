
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const Parser = require("rss-parser");
const readline = require("readline");

const parser = new Parser();
const MEDIUM_BASE_URL = "https://medium.com";
const MAX_CONCURRENT_REQUESTS = 5; // limit concurrency

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

    return feed.items.map(item => ({
      title: item.title,
      link: item.link,
      preview: item.contentSnippet,
    }));
  } catch (error) {
    console.error("Error fetching RSS feed:", error.message);
    return [];
  }
}

// Fetch full content of an article
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
    console.error(`Error fetching content from ${url}:`, error.message);
    return "";
  }
}

// Fetch full content concurrently in batches
async function fetchArticlesContentConcurrently(articles) {
  const results = [];
  for (let i = 0; i < articles.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = articles.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(
      batch.map(async article => {
        article.fullContent = await fetchArticleContent(article.link);
        return article;
      })
    );
    results.push(...batchResults);
  }
  return results;
}

// Crawl Medium user
async function crawlMediumUser(input) {
  const username = extractUsername(input);
  const articles = await fetchArticlesFromRSS(username);

  const articlesWithContent = await fetchArticlesContentConcurrently(articles);
  return { username, articles: articlesWithContent };
}

// === INTERACTIVE CLI ===
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter Medium username or profile URL: ", async (input) => {
  try {
    const { username, articles } = await crawlMediumUser(input);

    console.log(`\nFound ${articles.length} articles for @${username}\n`);
    articles.forEach((a, i) => {
      console.log(`[${i + 1}] ${a.title}`);
      console.log(`Link: ${a.link}`);
      console.log(`Preview: ${a.preview}`);
      console.log(`Full content snippet: ${a.fullContent.slice(0, 200)}...\n`);
    });

    const filename = `${username}_articles.json`;
    fs.writeFileSync(filename, JSON.stringify(articles, null, 2));
    console.log(`All articles saved to ${filename}`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    rl.close();
  }
});
