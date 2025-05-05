"use client"; // Ensures this is a Client Component

// --- Imports ---
import React, { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';

// --- Types Definition ---
type Article = {
    title: string | undefined;
    link: string | undefined;
    pubDate: string | undefined;
    contentSnippet: string | undefined;
    isoDate?: string | undefined;
    sourceName: string;
    id: string; // Ensure ID is always present
};

// --- Category Definitions & Keywords ---
const categories = {
    All: [],
    AI: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'neural network', 'agentic'],
    Cloud: ['cloud', 'aws', 'azure', 'gcp', 'serverless', 'kubernetes', 'docker', 'terraform'],
    Security: ['security', 'cybersecurity', 'malware', 'breach', 'vulnerability', 'hacking', 'encryption'],
    Jobs: ['hiring', 'job', 'career', 'layoff', 'recruit', 'internship'],
    'Web Dev': ['web dev', 'frontend', 'backend', 'javascript', 'react', 'vue', 'angular', 'node.js', 'next.js'], // Key with space requires quotes
    Python: ['python'],
    Java: ['java', 'jvm', 'spring'],
};
// Type for category names based on the object keys
type CategoryName = keyof typeof categories;


// --- Helper Function for Date Formatting ---
function formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch {
        console.warn("Could not parse date:", dateString);
        return '';
    }
}

// --- Main Component ---
export default function TrendsPage() {
    // --- State Definitions ---
    const [allArticles, setAllArticles] = useState<Article[]>([]);
    const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('All');
    const [selectedCategory, setSelectedCategory] = useState<CategoryName>('All');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [showFavorites, setShowFavorites] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Effect: Fetch Data from API Route ---
    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            setError(null);
            setAllArticles([]);
            setFilteredArticles([]);
            try {
                const response = await fetch('/api/trends');
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API Error: ${response.status}`);
                }
                const data = await response.json();
                if (!data.articles || !Array.isArray(data.articles)) {
                    throw new Error("Invalid data format received.");
                }
                setAllArticles(data.articles);
                setFilteredArticles(data.articles);
            } catch (err: any) {
                console.error("❌ Client fetch error:", err);
                setError(err.message || "Failed to load tech feeds.");
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []); // Runs once on mount

    // --- Effect: Load Favorites ---
    useEffect(() => {
        const storedFavorites = localStorage.getItem('techTrendsFavorites');
        if (storedFavorites) {
            try {
                const parsedFavorites = JSON.parse(storedFavorites);
                if (Array.isArray(parsedFavorites) && parsedFavorites.every(item => typeof item === 'string')) {
                    setFavorites(parsedFavorites);
                } else {
                    localStorage.removeItem('techTrendsFavorites');
                    setFavorites([]);
                }
            } catch (e) {
                console.error("Parsing favorites error", e);
                localStorage.removeItem('techTrendsFavorites');
                setFavorites([]);
            }
        }
    }, []); // Runs once on mount

    // --- Callback: Toggle Favorite ---
    const toggleFavorite = useCallback((articleId: string) => {
        const updatedFavorites = favorites.includes(articleId)
            ? favorites.filter(id => id !== articleId)
            : [...favorites, articleId];
        setFavorites(updatedFavorites);
        localStorage.setItem('techTrendsFavorites', JSON.stringify(updatedFavorites));
    }, [favorites]); // Dependency on favorites

    // --- Effect: Apply Filters/Search ---
    useEffect(() => {
        let result = allArticles;

        // Filter by Source
        if (selectedSource !== 'All') {
            result = result.filter(article => article.sourceName === selectedSource);
        }

        // Filter by Category
        if (selectedCategory !== 'All') {
            const categoryKeywords = categories[selectedCategory];
            if (categoryKeywords && categoryKeywords.length > 0) { // Check if keywords exist
                result = result.filter(article => {
                    const titleLower = article.title?.toLowerCase() || '';
                    const snippetLower = article.contentSnippet?.toLowerCase() || '';
                    return categoryKeywords.some(keyword => // Check if any keyword matches
                        titleLower.includes(keyword) || snippetLower.includes(keyword)
                    );
                }); // End filter
            } // End if keywords exist
        } // End category filter

        // Filter by Search Term
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            result = result.filter(article =>
                article.title?.toLowerCase().includes(lowerSearchTerm) ||
                article.contentSnippet?.toLowerCase().includes(lowerSearchTerm)
            ); // End filter
        } // End search filter

        setFilteredArticles(result);
    }, [searchTerm, selectedSource, selectedCategory, allArticles]); // Correct dependencies

    // --- Memoize: Source List ---
    const sources = useMemo(() => (
        ['All', ...Array.from(new Set(allArticles.map(a => a.sourceName))).sort()]
    ), [allArticles]); // Correct dependency

    // --- Memoize: Articles to Display ---
    const articlesToDisplay = useMemo(() => (
        showFavorites ? allArticles.filter(a => favorites.includes(a.id)) : filteredArticles
    ), [showFavorites, allArticles, favorites, filteredArticles]); // Correct dependencies

// --- !! ENSURE NO SYNTAX ERRORS ABOVE THIS LINE !! ---

    // --- Render UI ---
    return (
        // Main container
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-black bg-white min-h-screen font-sans">
            
            {/* Header */}
            <h1 className="text-3xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-3">
                Latest Tech Updates
            </h1>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6 sticky top-16 bg-white/95 backdrop-blur-sm py-3 z-20 border-b border-gray-100 items-center">
                {/* Search Input */}
                <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto sm:flex-grow bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    aria-label="Search articles"
                />
                 {/* Source Filter Dropdown */}
                 <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                    aria-label="Filter by source"
                >
                    {sources.map(source => ( <option key={source} value={source}>{source}</option> ))}
                </select>
                {/* Category Filter Dropdown */}
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as CategoryName)}
                    className="w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition duration-200"
                    aria-label="Filter by category"
                >
                    {/* Ensure Object.keys(categories) is safe */}
                    {(Object.keys(categories) as CategoryName[]).map(category => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
                {/* Favorites Toggle Button */}
                <button
                    onClick={() => setShowFavorites(!showFavorites)}
                    className={`w-full sm:w-auto px-4 py-1.5 rounded-md border text-sm font-medium transition duration-200 flex-shrink-0 ${
                        showFavorites
                        ? 'border-blue-500 text-blue-600 ring-1 ring-blue-200 shadow-sm'
                        : 'border-gray-300 text-black hover:border-gray-400'
                    }`}
                >
                    {showFavorites ? `★ Favorites (${favorites.length})` : '★ Show Favorites'}
                </button>
            </div>

            {/* Conditional Rendering: Loading, Error, Content */}
            {isLoading && ( <div className="text-center text-gray-500 py-10">Loading tech feed...</div> )}
            {!isLoading && error && ( <div className="text-center text-red-600 py-10 px-4 border border-red-200 bg-red-50 rounded-md">{error}</div> )}
            {!isLoading && !error && (
                 <>
                     {articlesToDisplay.length === 0 && ( <p className="text-center text-gray-500 mt-10 py-10">{showFavorites ? "No favorites marked yet." : "No articles match your current filters."}</p> )}
                     {/* Article Grid */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                         {articlesToDisplay.map((article) => {
                             const isFavorite = favorites.includes(article.id);
                             return (
                                 // Article Card Container
                                 <div key={article.id} className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col group">
                                     {/* Favorite Button */}
                                     <button
                                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(article.id); }}
                                         className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors duration-150 z-10 ${ isFavorite ? 'text-yellow-500 bg-yellow-100/50 hover:bg-yellow-200/60' : 'text-gray-400 bg-white/50 hover:bg-gray-100 hover:text-gray-600' }`}
                                         aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                     >
                                         {/* Star SVG */}
                                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"> <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354l-4.599 2.735c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" /> </svg>
                                     </button>
                                     {/* Link wrapping content */}
                                     <a href={article.link} target="_blank" rel="noopener noreferrer" className="flex flex-col flex-grow p-4 overflow-hidden">
                                        <h2 className="text-md font-semibold mb-2 text-black group-hover:text-blue-700 line-clamp-3"> {article.title || 'Untitled Article'} </h2>
                                        <p className="text-sm text-gray-600 mb-3 flex-grow line-clamp-3"> {article.contentSnippet} </p>
                                        <div className="text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100 flex justify-between items-center">
                                            <span className="font-medium truncate pr-2" title={article.sourceName}>{article.sourceName}</span>
                                            <span className="flex-shrink-0">{formatDate(article.isoDate || article.pubDate)}</span>
                                        </div>
                                     </a>
                                 </div>
                             );
                         })}
                     </div>
                 </>
             )}
        </div> // Closing main div
    ); // Closing return
} // Closing component function