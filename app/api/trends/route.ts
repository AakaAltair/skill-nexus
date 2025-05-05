// CORRECT LOCATION: app/api/trends/route.ts
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

// Define types within the API route as well for clarity
type Article = {
    title: string | undefined;
    link: string | undefined;
    pubDate: string | undefined;
    contentSnippet: string | undefined;
    isoDate?: string | undefined;
    sourceName: string;
    id: string; // This ID must be unique across ALL fetched articles
};

// Re-use the fetchFeed helper function (now running on the server)
async function fetchFeed(feedUrl: string, sourceName: string): Promise<Article[]> {
    const parser: Parser = new Parser();
    console.log(`Server Fetching: ${sourceName}`);
    try {
        const feed = await parser.parseURL(feedUrl);
        // Limit items and create IDs
        return feed.items.slice(0, 20).map((item, index) => ({
            title: item.title?.trim(),
            link: item.link,
            pubDate: item.pubDate,
            contentSnippet: item.contentSnippet ? item.contentSnippet.trim().substring(0, 150) + '...' : 'No snippet available.',
            isoDate: item.isoDate,
            sourceName: sourceName,
            // --- CORRECTED ID GENERATION ---
            // Always prepend sourceName to ensure uniqueness across different feeds
            id: `${sourceName}-${item.link || item.guid || item.title || index}`,
            // --- END CORRECTION ---
        }));
    } catch (error) {
        console.error(`❌ Server Fetch/Parse Error (${sourceName} - ${feedUrl}):`, error);
        return []; // Return empty on error
    }
}

// Define the GET handler for this route
export async function GET() {
    console.log("API Route /api/trends called");
    const feedSources = [
        { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
        { url: 'http://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica' },
        { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
        { url: 'https://hnrss.org/newest?points=100', name: 'Hacker News (>100)'}, // Note: HN might not have stable links/guids sometimes
        { url: 'https://www.wired.com/feed/rss', name: 'Wired'},
        { url: 'https://stackoverflow.blog/feed/', name: 'Stack Overflow Blog' },
        // Add more feeds
    ];

    try {
        const fetchPromises = feedSources.map(source => fetchFeed(source.url, source.name));
        // Wait for all feeds to settle (complete or fail)
        const results = await Promise.allSettled(fetchPromises);

        let allArticles: Article[] = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allArticles = allArticles.concat(result.value);
            } else {
                console.warn(`Feed fetch failed for ${feedSources[index].name}: ${result.reason}`);
                // Optionally include error info in response if needed for debugging client-side
            }
        });

        // Optional: Deduplicate based on link AFTER ensuring unique IDs (if strict deduplication is needed)
        // This step might remove legitimate duplicates if your ID logic wasn't perfect,
        // but with the sourceName prepended, it's less critical unless the *same source* duplicates links.
        // const uniqueArticles = Array.from(new Map(allArticles.map(article => [article.link, article])).values());
        // console.log(`Reduced from ${allArticles.length} to ${uniqueArticles.length} unique articles based on link.`);
        // allArticles = uniqueArticles;


        // Sort articles by date (newest first) on the server
        allArticles.sort((a, b) => {
            // Add robust date parsing/fallback
            const dateA = a.isoDate ? new Date(a.isoDate).getTime() : (a.pubDate ? new Date(a.pubDate).getTime() : 0);
            const dateB = b.isoDate ? new Date(b.isoDate).getTime() : (b.pubDate ? new Date(b.pubDate).getTime() : 0);
             // Handle invalid dates resulting in NaN
             if (isNaN(dateA)) return 1; // Treat invalid dates as older
             if (isNaN(dateB)) return -1;
            return dateB - dateA; // Newest first
        });

        console.log(`API Route returning ${allArticles.length} sorted articles.`);
        // Return the combined and sorted articles as JSON
        return NextResponse.json({ articles: allArticles });

    } catch (error) {
        console.error("❌ Error in /api/trends route:", error);
        // Return a server error response
        return NextResponse.json({ error: 'Failed to fetch trends data.' }, { status: 500 });
    }
}

// Optional: Add revalidation if needed later
// export const revalidate = 3600; // Revalidate data every hour (example)