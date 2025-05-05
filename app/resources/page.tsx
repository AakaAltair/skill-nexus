// app/resources/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Resource, ResourceType } from '@/lib/types/resource'; // Import resource types
import { User, getAuth, onAuthStateChanged } from 'firebase/auth';
import app from '@/app/firebase'; // Your Firebase client app instance
import ResourceCard from '@/components/ResourceCard'; // Import the ResourceCard component

// --- Types & Options ---
// Define the possible views for the resource list
type ResourceView = 'all' | 'favorites' | 'myResources';
// Define the available sorting options
type SortOption = 'newest' | 'oldest' | 'titleAZ' | 'titleZA';

// Define filter options for ResourceType dropdown
const resourceTypeFilterOptions: Array<ResourceType | 'All'> = [
    'All', 'Notes', 'Question Bank', 'Research Paper', 'Video',
    'Link Collection', 'Book PDF', 'Presentation', 'Code Repository', 'Other'
];

// --- Main Resources Page Component ---
export default function ResourcesPage() {
    const auth = getAuth(app);

    // --- Core State ---
    const [allFetchedResources, setAllFetchedResources] = useState<Resource[]>([]); // Raw data from API for current view
    const [displayedResources, setDisplayedResources] = useState<Resource[]>([]); // Data after all filtering/sorting
    const [isLoading, setIsLoading] = useState(true); // Loading state (primarily for fetching)
    const [error, setError] = useState<string | null>(null); // Error message state
    const [user, setUser] = useState<User | null>(null); // Current authenticated user
    const [authChecked, setAuthChecked] = useState(false); // Track if initial auth check is done
    const [favorites, setFavorites] = useState<string[]>([]); // Array of favorite resource IDs

    // --- View State ---
    const [activeView, setActiveView] = useState<ResourceView>('all'); // Default view

    // --- Filter/Search/Sort State ---
    const [searchTerm, setSearchTerm] = useState(''); // Main search input
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<ResourceType | 'All'>('All'); // Type dropdown
    const [sortBy, setSortBy] = useState<SortOption>('newest'); // Sort dropdown
    const [branchFilter, setBranchFilter] = useState<string>(''); // Branch text input filter
    const [yearFilter, setYearFilter] = useState<string>('');     // Year text input filter
    const [collegeFilter, setCollegeFilter] = useState<string>(''); // College text input filter
    const [subjectFilter, setSubjectFilter] = useState<string>(''); // Subject text input filter

    // --- Effect: Auth Listener & View Reset on Logout ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            const previousUser = user;
            setUser(currentUser);
            setAuthChecked(true);
            // Reset to 'all' view if user logs out while viewing 'My Resources'
            if (previousUser && !currentUser && activeView === 'myResources') {
                console.log("User logged out, switching view from 'My Resources' to 'all'");
                setActiveView('all');
            }
        });
        return () => unsubscribe(); // Cleanup listener
    }, [auth, activeView, user]); // Include activeView & user for logout logic


    // --- Effect: Load Favorites from localStorage ---
    useEffect(() => {
        console.log("Loading resource favorites from localStorage...");
        const storedFavorites = localStorage.getItem('skillNexusResourceFavorites'); // Use specific key
        if (storedFavorites) {
            try {
                const parsed = JSON.parse(storedFavorites);
                if (Array.isArray(parsed)) setFavorites(parsed);
            } catch (e) { console.error("Failed to parse resource favorites:", e); }
        }
    }, []); // Load once on mount


    // --- Effect: Fetch Resources based on Active View ---
    useEffect(() => {
        // Don't fetch if auth isn't checked yet or if view is 'favorites'
        if (!authChecked || activeView === 'favorites') {
             if (activeView === 'favorites') setIsLoading(false); // Ensure loading stops if landing on favorites
            return;
        }
        // If trying to view 'myResources' but not logged in, stop and clear data
        if (activeView === 'myResources' && !user) {
            console.warn("Attempted 'myResources' fetch without user.");
            setAllFetchedResources([]);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        async function loadResources() {
            setIsLoading(true); // Set loading true when starting fetch
            setError(null); // Clear previous errors

            // Construct API URL based on view
            let apiUrl = '/api/resources';
            if (activeView === 'myResources' && user?.uid) {
                apiUrl += `?userId=${user.uid}`; // Add user ID for filtering
            }

            try {
                console.log(`Fetching resources for view '${activeView}' from: ${apiUrl}`);
                const response = await fetch(apiUrl);
                if (!isMounted) return; // Check component mount status

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `API Error ${response.status}` }));
                    throw new Error(errorData.error || `Failed to fetch (${response.status})`);
                }

                const responseData = await response.json();
                // Expecting { resources: [...] } format from API
                if (!responseData || !Array.isArray(responseData.resources)) {
                    throw new Error("Invalid data format received from API.");
                }
                const resourcesArray: Resource[] = responseData.resources;

                if (isMounted) {
                    setAllFetchedResources(resourcesArray);
                    // Don't set loading false here; let the filter/sort effect handle it
                }

            } catch (err: any) {
                console.error(`❌ Fetch resources error (view: ${activeView}):`, err);
                if (isMounted) {
                    setError(err.message || "Could not load resources.");
                    setAllFetchedResources([]); // Clear data on error
                    setIsLoading(false); // Set loading false on fetch error
                }
            }
            // Note: setIsLoading(false) is primarily handled in the filter effect or on error
        }

        loadResources(); // Execute fetch

        return () => { isMounted = false; }; // Cleanup function

    }, [activeView, authChecked, user]); // Dependencies for fetching


    // --- Effect: Apply Filters, Sort, and Update Displayed Resources ---
    useEffect(() => {
        // This effect processes the fetched data whenever it or filters change.
        console.log("Applying filters/sort to resources...");

        // If still loading data OR if not loading but have no data (and not favorites view), wait/do nothing.
        if ((isLoading && allFetchedResources.length === 0 && activeView !== 'favorites')) {
            return;
        }

        let baseData: Resource[] = [];
        if (activeView === 'favorites') {
            // Base data for favorites is the fetched 'all' data filtered by ID
            baseData = allFetchedResources.filter(r => r.id && favorites.includes(r.id));
        } else {
            // Base data for 'all' or 'myResources' is the data fetched for that specific view
            baseData = [...allFetchedResources];
        }

        // Apply text-based filters sequentially
        let filteredResult = baseData;
        if (selectedTypeFilter !== 'All') {
            filteredResult = filteredResult.filter(r => r.resourceType === selectedTypeFilter);
        }
        if (branchFilter.trim()) {
            const lowerBranch = branchFilter.trim().toLowerCase();
            filteredResult = filteredResult.filter(r => r.branch?.toLowerCase().includes(lowerBranch));
        }
        if (yearFilter.trim()) {
            const lowerYear = yearFilter.trim().toLowerCase();
            filteredResult = filteredResult.filter(r => r.year?.toLowerCase().includes(lowerYear));
        }
        if (collegeFilter.trim()) {
            const lowerCollege = collegeFilter.trim().toLowerCase();
            filteredResult = filteredResult.filter(r => r.college?.toLowerCase().includes(lowerCollege));
        }
        if (subjectFilter.trim()) {
            const lowerSubject = subjectFilter.trim().toLowerCase();
            filteredResult = filteredResult.filter(r => r.subject?.toLowerCase().includes(lowerSubject));
        }

        // Apply main search term across multiple fields
        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.trim().toLowerCase();
            filteredResult = filteredResult.filter(r =>
                r.title?.toLowerCase().includes(lowerSearch) ||
                r.description?.toLowerCase().includes(lowerSearch) ||
                r.subject?.toLowerCase().includes(lowerSearch) ||
                r.branch?.toLowerCase().includes(lowerSearch) ||
                r.college?.toLowerCase().includes(lowerSearch) ||
                r.year?.toLowerCase().includes(lowerSearch) ||
                r.tags?.some(t => t.toLowerCase().includes(lowerSearch))
            );
        }

        // Apply Sorting
        const sortedResult = [...filteredResult].sort((a, b) => {
            // Safe date conversion helper
            const safeGetTime = (dateStr: string | undefined): number => {
                if (!dateStr) return 0;
                try { return new Date(dateStr.toString()).getTime() || 0; } catch { return 0; }
            };
            const dateA = safeGetTime(a.createdAt?.toString());
            const dateB = safeGetTime(b.createdAt?.toString());
            const titleA = a.title?.toLowerCase() || '';
            const titleB = b.title?.toLowerCase() || '';

            switch (sortBy) {
                case 'oldest': return dateA - dateB;
                case 'titleAZ': return titleA.localeCompare(titleB);
                case 'titleZA': return titleB.localeCompare(titleA);
                case 'newest': default: return dateB - dateA;
            }
        });

        // Update the state for displayed resources
        setDisplayedResources(sortedResult);

        // Ensure loading is set to false after processing,
        // especially if the initial data arrived and triggered this effect.
        if (isLoading) {
            setIsLoading(false);
        }

        console.log(`Filtered/Sorted resources result size: ${sortedResult.length}`);

    // Dependencies: Rerun when view, source data, favorites, or any filter/sort criteria changes.
    // isLoading is included to ensure loading is set to false correctly after fetch+filter.
    }, [
        activeView, allFetchedResources, favorites, selectedTypeFilter, searchTerm, sortBy,
        branchFilter, yearFilter, collegeFilter, subjectFilter, isLoading
    ]);


    // --- Favorite Toggle Callback ---
    const toggleFavorite = useCallback((resourceId: string) => {
        if (!resourceId) return;
        setFavorites(prevFavorites => {
            const updatedFavorites = prevFavorites.includes(resourceId)
                ? prevFavorites.filter(id => id !== resourceId) // Remove
                : [...prevFavorites, resourceId]; // Add
            localStorage.setItem('skillNexusResourceFavorites', JSON.stringify(updatedFavorites));
            return updatedFavorites;
        });
    }, []); // No external dependencies


    // --- Helper for Filter Button styling ---
    const getButtonClasses = (view: ResourceView): string => {
        const base = "px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 border";
        let activeColorClasses = "";
        let inactiveColorClasses = "bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"; // Default inactive style

        if (activeView === view) {
            // Define active styles for each view
            switch(view) {
                case 'all': activeColorClasses = "bg-blue-600 border-blue-600 text-white shadow-sm"; break;
                case 'myResources': activeColorClasses = "bg-indigo-600 border-indigo-600 text-white shadow-sm"; break;
                case 'favorites': activeColorClasses = "bg-yellow-500 border-yellow-500 text-white shadow-sm"; break;
            }
            return `${base} ${activeColorClasses}`;
        } else {
            // Define hover styles for inactive buttons
            if (view === 'favorites') inactiveColorClasses += " hover:border-yellow-400";
            else if (view === 'myResources') inactiveColorClasses += " hover:border-indigo-400";
            else inactiveColorClasses += " hover:border-blue-400"; // Default for 'all'
            return `${base} ${inactiveColorClasses}`;
        }
    };

    // --- Styling Variables ---
    const selectStyle = "bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 w-full sm:w-auto h-9";
    const inputStyle = "bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 w-full h-9";
    const filterInputStyle = "bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-9 w-full"; // Matched height

    // --- Render UI ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-black bg-white min-h-screen font-sans">

            {/* Header Section */}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Shared Resources</h1>
                {user && ( // Show "Share Resource" button only if logged in
                    <Link href="/resources/create" legacyBehavior>
                        <a className="inline-flex items-center gap-1.5 bg-white text-gray-800 border border-gray-300 font-medium py-1.5 px-4 rounded-md text-sm hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150 whitespace-nowrap shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>
                            Share Resource
                        </a>
                    </Link>
                )}
            </div>

            {/* --- Sticky Controls Bar --- */}
            <div className="sticky top-16 bg-white/95 backdrop-blur-sm py-4 z-20 border-b border-gray-100 space-y-3"> {/* Added space-y */}
                {/* Top Row: View Toggles & Main Search */}
                <div className="flex flex-col md:flex-row flex-wrap gap-4 items-center">
                    {/* View Toggles */}
                    <div className="flex gap-2 flex-shrink-0 w-full md:w-auto order-1 justify-center md:justify-start">
                        <button onClick={() => setActiveView('all')} className={getButtonClasses('all')}> Explore All </button>
                        {authChecked && user && (
                            <button onClick={() => setActiveView('myResources')} className={getButtonClasses('myResources')}> My Resources </button>
                        )}
                        <button onClick={() => setActiveView('favorites')} className={getButtonClasses('favorites')}> ★ Favorites </button>
                    </div>
                    <div className="hidden md:block md:flex-grow order-2"></div> {/* Spacer */}
                    {/* Main Search Input */}
                    <div className="w-full md:w-auto md:max-w-xs order-2 md:order-3">
                        <input
                            type="search"
                            placeholder="Search title, desc, tags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={inputStyle} // Consistent main input style
                            aria-label="Search resources"/>
                    </div>
                </div>

                {/* Bottom Row: Detailed Filters & Sort */}
                 {/* Use flex-wrap for better responsiveness */}
                 <div className="flex flex-wrap gap-3 items-center">
                    {/* Type Filter (Select) */}
                     <div className="w-full sm:w-auto"> {/* Control width */}
                        <select value={selectedTypeFilter} onChange={(e) => setSelectedTypeFilter(e.target.value as ResourceType | 'All')} className={selectStyle} aria-label="Filter by resource type">
                             {resourceTypeFilterOptions.map(type => ( <option key={type} value={type}>{type === 'All' ? 'All Types' : type}</option> ))}
                        </select>
                     </div>
                    {/* Branch Filter (Input) */}
                    <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-32"> {/* Adjusted width */}
                        <input type="text" placeholder="Branch..." value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={filterInputStyle} aria-label="Filter by branch"/>
                    </div>
                    {/* Year Filter (Input) */}
                    <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-28"> {/* Adjusted width */}
                         <input type="text" placeholder="Year..." value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={filterInputStyle} aria-label="Filter by year"/>
                    </div>
                    {/* Subject Filter (Input) */}
                     <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-32"> {/* Adjusted width */}
                         <input type="text" placeholder="Subject..." value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={filterInputStyle} aria-label="Filter by subject"/>
                    </div>
                    {/* College Filter (Input) */}
                     <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-36"> {/* Adjusted width */}
                         <input type="text" placeholder="College..." value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)} className={filterInputStyle} aria-label="Filter by college"/>
                    </div>
                    {/* Sort By (Select) - Pushed to the end on medium+ screens */}
                     <div className="w-full sm:w-auto md:ml-auto">
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className={selectStyle} aria-label="Sort resources">
                            <option value="newest">Sort: Newest</option>
                            <option value="oldest">Sort: Oldest</option>
                            <option value="titleAZ">Sort: Title A-Z</option>
                            <option value="titleZA">Sort: Title Z-A</option>
                        </select>
                    </div>
                 </div>
            </div>
            {/* --- End Controls Bar --- */}

            {/* --- Content Area --- */}
            <div className="pt-4">
                {/* Loading State Indicator */}
                {isLoading && (
                    <div className="flex justify-center items-center text-gray-500 py-20">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path>
                        </svg>
                        Loading resources...
                    </div>
                )}
                {/* Error Message Display */}
                {!isLoading && error && (
                    <div className="text-center text-red-600 py-10 px-4 border border-red-200 bg-red-50 rounded-md">
                        Error: {error}
                    </div>
                 )}
                {/* Content Display (Grid or Empty State) */}
                {!isLoading && !error && (
                    <>
                        {/* Empty State Message */}
                        {displayedResources.length === 0 && (
                             <p className="text-center text-gray-500 mt-10 py-10">
                                {/* Tailored empty state messages */}
                                {activeView === 'myResources' && (user ? "You haven't shared any resources yet." : "Please log in to see your shared resources.")}
                                {activeView === 'favorites' && "You haven't marked any resources as favorites yet."}
                                {activeView === 'all' && (
                                    searchTerm.trim() || selectedTypeFilter !== 'All' || branchFilter.trim() || yearFilter.trim() || collegeFilter.trim() || subjectFilter.trim()
                                    ? "No resources match your current search and filters."
                                    : "No resources have been shared yet. Be the first!"
                                )}
                             </p>
                         )}
                        {/* Resource Grid */}
                        {displayedResources.length > 0 && (
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                                {displayedResources.map((resource) => (
                                    // Pass favorite state and handler to the card
                                    <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        isFavorite={resource.id ? favorites.includes(resource.id) : false}
                                        onToggleFavorite={toggleFavorite}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}