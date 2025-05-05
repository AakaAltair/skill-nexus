// app/projects/page.tsx
"use client"; // Required for hooks like useState, useEffect, useSearchParams

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // For reading initial view state
import { Project, ProjectType, ProjectStatus } from '@/lib/types/project'; // Import types
import { User, getAuth, onAuthStateChanged } from 'firebase/auth'; // Import auth types
import app from '@/app/firebase'; // Import firebase app instance
import ProjectCard from '@/components/ProjectCard'; // Import the ProjectCard component

// --- Types & Options ---
type ProjectView = 'all' | 'myProjects' | 'favorites';
type SortOption = 'newest' | 'oldest' | 'updated';
const categoryOptions: ProjectType[] = ["Personal", "College Course", "Department Initiative", "Competition", "Research", "Open Source Contribution", "Startup Idea", "Tutorial/Example", "Other"];
const statusOptions: ProjectStatus[] = ["Idea", "Planning", "In Progress", "Paused", "Completed", "Archived"];

// --- Main Projects Page Component ---
export default function ProjectsPage() {
    const searchParams = useSearchParams(); // Hook to read URL query parameters
    const auth = getAuth(app); // Firebase auth instance

    // --- State ---
    const [allFetchedProjects, setAllFetchedProjects] = useState<Project[]>([]); // Raw data from fetch for current view
    const [displayedProjects, setDisplayedProjects] = useState<Project[]>([]); // Data after all filtering/sorting
    const [isLoading, setIsLoading] = useState(true); // Loading state for fetching
    const [error, setError] = useState<string | null>(null); // Error message state
    const [user, setUser] = useState<User | null>(null); // Current authenticated user
    const [authChecked, setAuthChecked] = useState(false); // Track if initial auth check is done
    const [favorites, setFavorites] = useState<string[]>([]); // Array of favorite project IDs

    // --- Filter/Search/Sort State ---
    const [searchTerm, setSearchTerm] = useState(''); // Search input value
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<ProjectType | 'All'>('All'); // Category dropdown state
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<ProjectStatus | 'All'>('All'); // Status dropdown state
    const [sortBy, setSortBy] = useState<SortOption>('newest'); // Sort dropdown state

    // --- View State (Initialized from URL param) ---
    const initialViewQueryParam = searchParams.get('view'); // Read ?view=...
    const [activeView, setActiveView] = useState<ProjectView>(() => {
        const validView = initialViewQueryParam === 'myProjects' ? 'myProjects' : initialViewQueryParam === 'favorites' ? 'favorites' : 'all';
        console.log("Initial view from URL:", initialViewQueryParam, "Setting view to:", validView);
        return validView;
    });

    // --- Effect: Auth Listener & View Adjustment ---
    useEffect(() => {
        setIsLoading(true); // Start loading when auth state might change
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            const wasUser = !!user; // Check previous login state
            setUser(currentUser);
            setAuthChecked(true); // Mark auth check as complete

            // If view was set to 'myProjects' (e.g., from URL) but user isn't logged in now, reset to 'all'
            if (activeView === 'myProjects' && !currentUser) {
                console.log("Auth check complete: User not logged in, resetting view from 'myProjects' to 'all'");
                setActiveView('all');
            }
            // Handle case where user logs out while viewing 'My Projects'
            if (wasUser && !currentUser && activeView === 'myProjects') {
                console.log("User logged out while on My Projects, switching view to 'all'");
                setActiveView('all');
            }
            // Let data fetching effect handle loading state based on authChecked and activeView
        });
        return () => unsubscribe();
    }, [auth, activeView, user]); // Dependencies for auth effect


    // --- Effect: Load Favorites from localStorage ---
    useEffect(() => {
        console.log("Loading favorites from localStorage...");
        const storedFavorites = localStorage.getItem('techTrendsFavorites');
        if (storedFavorites) {
            try {
                const parsed = JSON.parse(storedFavorites);
                if (Array.isArray(parsed)) setFavorites(parsed);
            } catch { console.error("Failed to parse favorites"); }
        }
    }, []); // Load once on mount


    // --- Effect: Fetch Projects Based on Active View ('all' or 'myProjects') ---
    useEffect(() => {
        if (activeView === 'favorites' || !authChecked) {
            if (activeView === 'favorites') setIsLoading(false); // Stop loading if starting on favorites
            return;
        }

        let isMounted = true;
        async function loadProjects() {
            setIsLoading(true); setError(null);

            let apiUrl = '/api/projects';
            if (activeView === 'myProjects') {
                if (user?.uid) { apiUrl += `?userId=${user.uid}`; } // Ensure user.uid exists
                else {
                    console.log("Cannot fetch 'My Projects', user not available.");
                    if(isMounted) setAllFetchedProjects([]);
                    if(isMounted) setIsLoading(false);
                    return;
                }
            }

            try {
                console.log(`Fetching projects for view '${activeView}' from: ${apiUrl}`);
                const response = await fetch(apiUrl);
                if (!isMounted) return;
                if (!response.ok) {
                    const d = await response.json().catch(()=>{ return { error: `API Error ${response.status}` }});
                    throw new Error(d.error || `API Error ${response.status}`);
                }
                const data = await response.json();
                if (!data.projects || !Array.isArray(data.projects)) throw new Error("Invalid data format received from API.");
                if (isMounted) setAllFetchedProjects(data.projects);
            } catch (err: any) {
                console.error("❌ Fetch projects error:", err);
                if (isMounted) setError(err.message || "Could not load projects.");
                if (isMounted) setAllFetchedProjects([]);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        loadProjects();
        return () => { isMounted = false; }; // Cleanup
    }, [activeView, user, authChecked]); // Dependencies


    // --- Effect: Apply Filters, Sort, and Update Displayed Projects ---
    useEffect(() => {
        console.log("Applying filters/sort...");
        let result: Project[] = [];

        // Base list determination
        if (activeView === 'favorites') {
            // Filter requires project.id and favorites array
            result = allFetchedProjects.filter(p => p.id && favorites.includes(p.id));
        } else {
            result = [...allFetchedProjects]; // Copy fetched data
        }

        // Apply filters
        if (selectedCategoryFilter !== 'All') {
            result = result.filter(p => p.projectType === selectedCategoryFilter);
        }
        if (selectedStatusFilter !== 'All') {
            result = result.filter(p => p.status === selectedStatusFilter);
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.title?.toLowerCase().includes(lowerSearch) ||
                p.description?.toLowerCase().includes(lowerSearch) ||
                p.skills?.some(s => s.toLowerCase().includes(lowerSearch))
            );
        }

        // Apply Sorting
        result.sort((a, b) => {
            // Use helper function for safe date conversion
            const safeGetTime = (dateStr: string | undefined): number => {
                if (!dateStr) return 0;
                try { return new Date(dateStr.toString()).getTime() || 0; } // Ensure conversion from potential Timestamp
                catch { return 0; }
            };
            const dateA = safeGetTime(a.createdAt?.toString());
            const dateB = safeGetTime(b.createdAt?.toString());
            const updatedA = safeGetTime(a.updatedAt?.toString());
            const updatedB = safeGetTime(b.updatedAt?.toString());

            switch (sortBy) {
                case 'oldest': return dateA - dateB;
                case 'updated': return updatedB - updatedA;
                case 'newest': default: return dateB - dateA;
            }
        });

        setDisplayedProjects(result);
        console.log(`Filtered/Sorted result size: ${result.length}`);

    }, [ activeView, allFetchedProjects, favorites, selectedCategoryFilter, selectedStatusFilter, searchTerm, sortBy ]); // Full dependency list


    // --- Favorite Toggle Callback ---
    const toggleFavorite = useCallback((projectId: string) => {
        if (!projectId) return;
        setFavorites(prevFavorites => {
            const updatedFavorites = prevFavorites.includes(projectId)
                ? prevFavorites.filter(id => id !== projectId)
                : [...prevFavorites, projectId];
            localStorage.setItem('techTrendsFavorites', JSON.stringify(updatedFavorites));
            return updatedFavorites;
        });
    }, []); // Favorites state itself isn't needed as dep, only setter is used


    // --- Helper for Filter Button styling ---
    const getButtonClasses = (view: ProjectView): string => {
        const base = "px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 border";
        let activeColorClasses = "";
        let inactiveColorClasses = "bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"; // Default inactive

        if (activeView === view) {
            switch(view) {
                case 'all': activeColorClasses = "bg-blue-600 border-blue-600 text-white shadow-sm"; break;
                case 'myProjects': activeColorClasses = "bg-indigo-600 border-indigo-600 text-white shadow-sm"; break;
                case 'favorites': activeColorClasses = "bg-green-600 border-green-600 text-white shadow-sm"; break;
            }
            return `${base} ${activeColorClasses}`;
        } else {
            // Subtle accent border on hover
            if (view === 'favorites') inactiveColorClasses += " hover:border-green-400";
            else inactiveColorClasses += " hover:border-blue-400";
            return `${base} ${inactiveColorClasses}`;
        }
    };

    // --- Styling Variables ---
    const selectStyle = "bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-black outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 w-full sm:w-auto h-9";
    const inputStyle = "bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-black outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 w-full h-9";


    // --- Render UI ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-black bg-white min-h-screen font-sans">

            {/* Header Section */}
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                 <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Explore Projects</h1>
                 {user && (
                    <Link href="/projects/create" legacyBehavior>
                        <a className="inline-flex items-center gap-1.5 bg-white text-gray-800 border border-gray-300 font-medium py-1.5 px-4 rounded-md text-sm hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150 whitespace-nowrap shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>
                            Create Project
                        </a>
                    </Link>
                 )}
            </div>

             {/* --- Sticky Controls Bar --- */}
            <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-8 sticky top-16 bg-white/95 backdrop-blur-sm py-4 z-20 items-center border-b border-gray-100">
                {/* View Toggles */}
                 <div className="flex gap-2 flex-shrink-0 w-full md:w-auto order-1 justify-center md:justify-start">
                     <button onClick={() => setActiveView('all')} className={getButtonClasses('all')}> Explore All </button>
                     {authChecked && user && ( <button onClick={() => setActiveView('myProjects')} className={getButtonClasses('myProjects')}> My Projects </button> )}
                     <button onClick={() => setActiveView('favorites')} className={getButtonClasses('favorites')}> ★ Favorites </button>
                 </div>

                 <div className="hidden md:block md:flex-grow order-2"></div> {/* Spacer */}

                 {/* Search */}
                 <div className="w-full md:w-auto md:max-w-xs order-2 md:order-3">
                     <input type="search" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputStyle} aria-label="Search projects"/>
                 </div>

                 {/* Filters & Sort */}
                 <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto order-3 md:order-4">
                     <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value as ProjectType | 'All')} className={selectStyle} aria-label="Filter by category">
                         <option value="All">All Categories</option>
                         {categoryOptions.map(type => ( <option key={type} value={type}>{type}</option> ))}
                     </select>
                     <select value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value as ProjectStatus | 'All')} className={selectStyle} aria-label="Filter by status">
                          <option value="All">All Statuses</option>
                         {statusOptions.map(s => ( <option key={s} value={s}>{s}</option> ))}
                     </select>
                     <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className={selectStyle} aria-label="Sort projects">
                         <option value="newest">Sort: Newest</option>
                         <option value="oldest">Sort: Oldest</option>
                         <option value="updated">Sort: Last Updated</option>
                     </select>
                 </div>
            </div>
            {/* --- End Controls Bar --- */}

            {/* --- Content Area --- */}
            <div className="pt-4">
                {isLoading && (
                    <div className="flex justify-center items-center text-gray-500 py-20">
                         <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                         Loading projects...
                    </div>
                 )}
                {!isLoading && error && ( <div className="text-center text-red-600 py-10 px-4 border border-red-200 bg-red-50 rounded-md"> Error: {error} </div> )}
                {!isLoading && !error && (
                     <>
                         {/* Empty State Message */}
                         {displayedProjects.length === 0 && (
                             <p className="text-center text-gray-500 mt-10 py-10">
                                {searchTerm && "No projects match your search and filters."}
                                {(!searchTerm && (selectedCategoryFilter !== 'All' || selectedStatusFilter !== 'All')) && "No projects match your selected filters."}
                                {(!searchTerm && selectedCategoryFilter === 'All' && selectedStatusFilter === 'All') && (
                                    activeView === 'favorites' ? "You haven't marked any projects as favorites yet." :
                                    activeView === 'myProjects' ? (user ? "You haven't created any projects yet." : "Please log in to see your projects.") :
                                    "No projects found."
                                )}
                            </p>
                         )}
                         {/* Project Grid */}
                         {displayedProjects.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {displayedProjects.map((project) => (
                                    <ProjectCard
                                        key={project.id} // Ensure key is stable and unique
                                        project={project}
                                        isFavorite={project.id ? favorites.includes(project.id) : false}
                                        onToggleFavorite={toggleFavorite}
                                        // Pass isOwner if card needs it, calculate based on current user
                                        // isOwner={user?.uid === project.creatorId}
                                        // onDeleteClick can be passed if delete functionality exists on the card
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