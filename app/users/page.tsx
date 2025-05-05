// app/users/page.tsx
"use client"; // Required for hooks like useState, useEffect, useSearchParams

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import firebaseApp from '@/app/firebase'; // Default export
import { Loader2, Search as SearchIcon, Mail } from 'lucide-react'; // Import icons
import debounce from 'lodash.debounce'; // Or use a custom debounce helper
import Link from 'next/link'; // Import Link component


// Define a minimal type for user search results
// This should match the structure returned by your /api/users/search endpoint
interface UserSearchResult {
    userId: string; // Crucial for linking to profile page
    name: string;
    photoURL?: string | null;
    headline?: string | null;
    // Include other fields returned by the API that you want to display
    // college?: string | null;
    // branch?: string | null;
}

// TODO: Move getInitials and isValidUrl to a shared utility file (e.g., lib/utils/avatarUtils.ts)
// Helper function to get initials from name or email
const getInitials = (name?: string | null, email?: string | null): string => {
    if (name) {
        const parts = name.trim().split(/\s+/).filter(Boolean); // Split by spaces and remove empty strings
        if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0]) {
             // Take first two letters if single name, or just first if less than 2
            return parts[0].substring(0, Math.min(parts[0].length, 2)).toUpperCase();
        }
    }
    if (email) {
         // Take first letter of email if no name or name is empty/only whitespace
        return email[0]?.toUpperCase() || '?'; // Use optional chaining and default if email is empty string
    }
    return 'P'; // Default placeholder (e.g., "Profile") if no name or email
};

// Simple URL validation (basic syntax check for http/https)
const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || url.trim() === '') return false; // A URL must be present and not just whitespace
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch (_) {
        return false;
    }
};

// --- Local Storage Key for Recent Searches ---
const RECENT_USER_SEARCHES_KEY = 'recentUserSearches';
const MAX_RECENT_SEARCHES = 5; // Limit the number of recent searches to store


export default function UsersPage() {
    const router = useRouter();
    const auth = getAuth(firebaseApp);

    // --- State ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true); // Still need to ensure user is logged in
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchAttempted, setSearchAttempted] = useState(false); // Track if search has been run at least once

    // --- State for Recent Searches ---
    const [recentSearches, setRecentSearches] = useState<string[]>([]);


    // --- Effect: Authentication Check ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
                console.log("User not authenticated, redirecting to login.");
                router.push('/login'); // Redirect if not authenticated
            }
            setAuthLoading(false);
        });
        return () => unsubscribe(); // Cleanup subscription
    }, [auth, router]); // Depend on auth and router for redirect


    // --- Effect: Load Recent Searches from localStorage ---
    useEffect(() => {
        console.log("Loading recent searches from localStorage...");
        const storedSearches = localStorage.getItem(RECENT_USER_SEARCHES_KEY);
        if (storedSearches) {
            try {
                const parsed = JSON.parse(storedSearches);
                // Ensure it's an array of strings and limit the size
                if (Array.isArray(parsed)) {
                     const validSearches = parsed.filter(item => typeof item === 'string');
                     setRecentSearches(validSearches.slice(0, MAX_RECENT_SEARCHES));
                }
            } catch (error) {
                console.error("Failed to parse recent searches from localStorage:", error);
                setRecentSearches([]); // Reset if parsing fails
            }
        }
    }, []); // Load once on mount


    // --- Helper to Update and Save Recent Searches ---
    const updateRecentSearches = useCallback((newTerm: string) => {
        if (!newTerm || newTerm.trim() === '') return; // Don't save empty searches

        setRecentSearches(prevSearches => {
            // Add the new term to the front, filter out duplicates, and limit size
            const updated = [newTerm.trim(), ...prevSearches.filter(term => term.toLowerCase() !== newTerm.trim().toLowerCase())]; // Case-insensitive uniqueness check
            const limited = updated.slice(0, MAX_RECENT_SEARCHES);
            localStorage.setItem(RECENT_USER_SEARCHES_KEY, JSON.stringify(limited));
            return limited;
        });
    }, []);


    // --- Search Function (Authenticated & Debounced) ---
    const performSearch = useCallback(debounce(async (term: string, token: string) => {
        console.log("Performing search for:", term);
        const trimmedTerm = term.trim();

        if (trimmedTerm.length < 2) { // Require at least 2 characters
            setSearchResults([]);
            setSearchLoading(false);
            setSearchError(null);
            setSearchAttempted(false); // Reset if term is too short
            return;
        }

        setSearchLoading(true);
        setSearchError(null);
        setSearchAttempted(true); // Mark that a search has been initiated

        try {
            // Call the backend search endpoint (Algolia or Firestore prefix)
            const response = await fetch(`/api/users/search?term=${encodeURIComponent(trimmedTerm)}`, {
                headers: { 'Authorization': `Bearer ${token}` }, // Send auth token
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: response.statusText }));
                 throw new Error(`Search failed: ${response.status} ${errorData.message || ''}`);
            }

            const data = await response.json();
             // Expecting { users: UserSearchResult[] } structure from API
             if (data && Array.isArray(data.users)) {
                setSearchResults(data.users);
                // --- Update recent searches ON SUCCESS ---
                 updateRecentSearches(trimmedTerm);
             } else {
                 console.error("Unexpected API response format for search:", data);
                 setSearchResults([]); // Ensure it's an empty array on unexpected data
                 setSearchError("Received unexpected data format from search.");
             }

        } catch (err: any) {
            console.error("Error during search:", err);
            setSearchError(err.message || 'An unknown error occurred during search.');
            setSearchResults([]); // Clear results on error
        } finally {
            setSearchLoading(false);
        }
    }, 300), [updateRecentSearches]); // Debounce by 300ms, updateRecentSearches is a dependency


    // --- Effect to trigger search when searchTerm or currentUser changes (after auth loads) ---
    useEffect(() => {
        // Trigger search only if user is authenticated and auth is not loading
        if (currentUser && !authLoading) {
            // Need the ID token for the API call
            getIdToken(currentUser)
                .then(token => {
                    if (token) {
                         // Call the debounced search function
                         performSearch(searchTerm, token);
                    } else {
                        console.warn("No ID token available for search.");
                        setSearchError("Authentication token missing. Please try logging in again.");
                         setSearchLoading(false);
                    }
                })
                 .catch(err => {
                    console.error("Error getting ID token for search:", err);
                    setSearchError("Failed to get authentication token.");
                     setSearchLoading(false);
                 });

        } else if (!authLoading && !currentUser) {
             // Clear search state if user logs out (handled by auth check redirect anyway)
             setSearchResults([]);
             setSearchError(null);
             setSearchAttempted(false);
             setSearchLoading(false); // Ensure loading stops
        }

        // Cleanup debounce on component unmount or effect re-run
        return () => {
            performSearch.cancel(); // Cancel any pending debounced calls
        };
         // Dependencies: Rerun if searchTerm changes or currentUser/authLoading state stabilizes
    }, [searchTerm, currentUser, authLoading, performSearch]);


    // --- Handle Clicking a Recent Search Term ---
     const handleRecentSearchClick = useCallback((term: string) => {
        setSearchTerm(term); // Update the search term input
        // The useEffect above will automatically trigger performSearch due to searchTerm change
     }, []);

     // --- Handle Clear Recent Searches ---
     const handleClearRecentSearches = useCallback(() => {
        setRecentSearches([]); // Clear state
        localStorage.removeItem(RECENT_USER_SEARCHES_KEY); // Clear localStorage
        console.log("Recent searches cleared.");
     }, []);


    // --- Render Loading/Error States (for initial auth) ---
     if (authLoading) {
        return (
            <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                <Loader2 className="animate-spin text-gray-500" size={32} />
                <span className="ml-2 text-gray-500">Loading User Session...</span>
            </div>
        );
    }

    if (!currentUser) {
         // This block should theoretically be unreachable due to the router.push('/login') above,
         // but it provides a moment for the redirect to occur.
         return (
             <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                 <span className="text-gray-500">Redirecting to login...</span>
             </div>
         );
     }

    // --- Main Render Function ---
    // If we reach this point, authLoading is false and currentUser exists.
    return (
        <div className="flex pt-16 bg-gray-50 min-h-screen"> {/* Navbar height offset */}

             {/* Simple main content layout */}
            <main className="flex-grow p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto max-w-4xl mx-auto w-full"> {/* Center content */}

                 <h1 className="text-2xl font-bold text-black mb-6">Explore Users</h1> {/* Renamed from User Directory */}

                {/* Search Input */}
                 <div className="relative mb-4"> {/* Reduced bottom margin */}
                     <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                     <input
                         type="text"
                         placeholder="Search users by name..."
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full rounded-md border border-gray-300 shadow-sm px-3 pl-10 py-2 text-base focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400"
                         aria-label="Search users"
                     />
                     {/* Optional: Clear button when input is not empty */}
                     {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            aria-label="Clear search"
                        >
                            × {/* Simple 'x' character */}
                        </button>
                     )}
                 </div>

                 {/* --- Recent Searches Display --- */}
                 {recentSearches.length > 0 && searchTerm === '' && !searchAttempted && (
                     <div className="mb-6 text-sm text-gray-700">
                         <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">Recent Searches</span>
                             <button onClick={handleClearRecentSearches} className="text-xs text-blue-600 hover:underline">Clear History</button>
                         </div>
                         <div className="flex flex-wrap gap-2">
                             {recentSearches.map((term, index) => (
                                 <button
                                     key={index} // Index as key is okay here since list is simple and reordered
                                     onClick={() => handleRecentSearchClick(term)}
                                     className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm hover:bg-gray-200 transition-colors"
                                 >
                                     {term}
                                 </button>
                             ))}
                         </div>
                     </div>
                 )}
                {/* --- End Recent Searches Display --- */}


                 {/* Search Results Display */}
                 <div className="mt-4"> {/* Adjusted top margin */}
                     {/* Show initial prompt if no search term */}
                     {searchTerm.trim().length < 2 && !searchAttempted && !searchLoading && (
                        <p className="text-center text-gray-500 italic">Enter at least 2 characters to search.</p>
                     )}

                     {searchLoading && (
                         // Show loader only if a search term is present and long enough
                         searchTerm.trim().length >= 2 && (
                             <div className="flex justify-center items-center text-gray-500">
                                <Loader2 className="animate-spin mr-2"/> Searching...
                             </div>
                         )
                     )}

                     {searchError && !searchLoading && (
                         <p className='text-sm text-red-600 italic px-2 py-1 bg-red-50 border border-red-200 rounded'>Error: {searchError}</p>
                     )}

                     {!searchLoading && !searchError && searchAttempted && searchResults.length === 0 && searchTerm.trim().length >= 2 && (
                         // Show "No users found" only if a search was attempted with a valid length term and yielded no results
                         <p className="text-center text-gray-500 italic">No users found matching "{searchTerm}".</p>
                     )}


                     {!searchLoading && !searchError && searchResults.length > 0 && (
                         <ul className="space-y-4">
                             {searchResults.map(user => (
                                 <li key={user.userId} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
                                    {/* Link to user's profile page - use Link component for Next.js routing */}
                                     {/* Ensure user.userId exists before linking */}
                                     {user.userId ? (
                                         <Link href={`/profile/${user.userId}`} className="flex items-center space-x-4 group">
                                            {/* User Avatar */}
                                             {/* Use <img> tag for simplicity with external URLs + fallback */}
                                             {(user.photoURL && isValidUrl(user.photoURL)) ? (
                                                 <img
                                                    src={user.photoURL}
                                                    alt={`${user.name}'s avatar`}
                                                    className="w-10 h-10 rounded-full object-cover border flex-shrink-0"
                                                     // No onError needed here, isValidUrl and fallback handle issues
                                                 />
                                             ) : (
                                                 // Fallback: Initials
                                                 <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-sm font-medium border flex-shrink-0">
                                                     {/* Use getInitials helper with search result name and userId (as a fallback for email) */}
                                                     {getInitials(user.name, user.userId)} {/* userId is guaranteed */}
                                                 </div>
                                             )}

                                            {/* User Info */}
                                             <div className="flex-grow min-w-0">
                                                 <h3 className="font-semibold text-black group-hover:underline truncate">{user.name || 'Unnamed User'}</h3>
                                                 {user.headline && (
                                                     <p className="text-sm text-gray-700 truncate">{user.headline}</p>
                                                 )}
                                                  {/* Add other fields like college/branch if returned by API and desired */}
                                             </div>
                                         </Link>
                                     ) : (
                                        // Handle case where userId is missing (shouldn't happen if API is correct)
                                        <div className="text-sm text-gray-500 italic p-2 -mx-2">Invalid user data received</div>
                                     )}
                                 </li>
                             ))}
                         </ul>
                     )}

                 </div>

            </main>
        </div>
    );
}