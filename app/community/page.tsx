// app/community/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { User, getAuth, onAuthStateChanged } from 'firebase/auth';
import firebaseApp from '@/app/firebase'; // Ensure this path is correct
import { CommunityPost, COMMUNITY_POST_CATEGORIES } from '@/lib/types/community'; // Adjust paths if needed
import CommunityPostCard from '@/components/CommunityPostCard'; // Path to your Post Card component
import Modal from '@/components/Modal'; // Your existing Modal component
import CommunityPostModal from '@/components/CommunityPostModal'; // Path to your Post Modal component
import { useRouter } from 'next/navigation';
import { PlusCircle, Loader2, Search, ListFilter, SlidersHorizontal, AlertCircle } from 'lucide-react'; // Added AlertCircle

const API_BASE_URL = '/api/community/posts'; // Base URL for the community posts API

// Define Sort Options Type
type SortOption = 'createdAt' | 'likesCount'; // Add more if needed

export default function CommunityFeedPage() {
  const router = useRouter();
  const auth = getAuth(firebaseApp);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true); // Loading state for posts specifically
  const [error, setError] = useState<string | null>(null);
  const [lastDocId, setLastDocId] = useState<string | null>(null); // Tracks the last doc ID for pagination
  const [hasMore, setHasMore] = useState(true); // Indicates if more posts are available

  // State for filters including type definition for sortBy
  const [filters, setFilters] = useState<{
    category: string;
    search: string;
    showMyPosts: boolean;
    sortBy: SortOption;
  }>({
    category: '',
    search: '',
    showMyPosts: false,
    sortBy: 'createdAt', // Default sort order
  });

  // State for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // --- Authentication Listener ---
  useEffect(() => {
    setAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      // If user logs out while viewing "My Posts", switch filter off
      if (!user && filters.showMyPosts) {
        setFilters(prev => ({ ...prev, showMyPosts: false }));
      }
      // No need to trigger fetch here, the effect below handles it based on authLoading
    });
    return () => unsubscribe();
  }, [auth, filters.showMyPosts]); // Dependency is fine

  // --- Fetch Posts Function ---
  const fetchPosts = useCallback(async (isInitialFetch = true) => {
    // Prevent fetching if not authenticated (as API requires it)
    // Also prevent if already loading or no more posts (unless initial)
    if (!currentUser || (loading && !isInitialFetch) || (!hasMore && !isInitialFetch)) {
        if (!currentUser && !authLoading) { // Only set error if auth is resolved and no user
            console.log("FetchPosts skipped: User not authenticated.");
            setPosts([]); // Clear posts if user logs out
            setHasMore(false); // No more posts if not logged in
            setError("Please sign in to view the community feed.");
            setLoading(false); // Ensure loading stops
        } else {
            console.log("FetchPosts skipped: Conditions not met (loading, no more, or auth loading).");
        }
        return; // Stop execution
    }


    setLoading(true);
    if (isInitialFetch) setError(null); // Clear previous errors on new fetch/filter

    // Build URL with filters and sorting
    let url = `${API_BASE_URL}?limit=15&sortBy=${filters.sortBy}`;
    if (filters.category) url += `&category=${encodeURIComponent(filters.category)}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`; // NOTE: Backend search needs implementation
    if (filters.showMyPosts) { // No need for currentUser?.uid check here, already checked above
         url += `&userId=${currentUser.uid}`;
    }
    if (!isInitialFetch && lastDocId) url += `&lastDocId=${lastDocId}`;

    try {
      // *** GET AUTH TOKEN ***
      const token = await currentUser.getIdToken();
      if (!token) {
          throw new Error("Could not retrieve authentication token.");
      }

      console.log(`Fetching posts from: ${url} with auth token.`);
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              // *** ADD AUTH HEADER ***
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json', // Optional for GET, but good practice
          },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(()=>({message: `API Error ${response.status}`}));
        // Handle specific auth error potentially
        if (response.status === 401 || response.status === 403) {
             throw new Error(errorData.message || "Authentication failed. Please sign in again.");
        }
        throw new Error(errorData.message || `Failed to fetch posts (${response.status})`);
      }

      const data = await response.json();
      const fetchedPosts: CommunityPost[] = data.posts || []; // Ensure posts is always an array

      setPosts(prevPosts => isInitialFetch ? fetchedPosts : [...prevPosts, ...fetchedPosts]);
      setHasMore(fetchedPosts.length === 15); // Assume more if limit is reached
      if (fetchedPosts.length > 0) {
          setLastDocId(fetchedPosts[fetchedPosts.length - 1].id);
      } else if (isInitialFetch) {
           // If initial fetch returns 0, don't change lastDocId (it's already null)
           // Ensure hasMore is false if 0 posts are returned initially
           setHasMore(false);
      }
      // Error state is handled in catch block

    } catch (err) {
      console.error('Fetch posts error:', err);
      setError((err as Error).message); // Set the error message
      setHasMore(false); // Stop pagination on error
      if (isInitialFetch) setPosts([]); // Clear posts on initial fetch error
    } finally {
      setLoading(false);
    }
  // Depend on filters, currentUser (for token), authLoading (to wait)
  // Removing lastDocId, hasMore, loading as direct dependencies of useCallback
  // fetchPosts calls itself recursively via scroll, so these change internally
  // We need currentUser.uid here because if the user changes, the token changes.
  }, [filters, currentUser, authLoading]);

  // --- Effect for Initial Fetch / Filter Change / Auth Change ---
  useEffect(() => {
    // Only trigger fetch when authentication is resolved
    if (!authLoading) {
      console.log("Auth loaded or Filters changed, triggering fetch:", filters, "User:", !!currentUser);
      setPosts([]); // Reset posts
      setLastDocId(null); // Reset pagination cursor
      setHasMore(true); // Assume there might be more posts
      fetchPosts(true); // Trigger the initial fetch
    }
  // Depend on the filters object, authLoading status, and currentUser
  // Fetch should re-run if user logs in/out OR filters change, BUT only when auth is resolved.
  }, [authLoading, filters, currentUser, fetchPosts]); // Added fetchPosts as dependency

  // --- Effect for Infinite Scroll ---
  useEffect(() => {
    const handleScroll = () => {
      // Don't run if auth still loading, or fetchPosts logic will handle skip
      if (authLoading || loading || !hasMore || window.innerHeight + window.scrollY < document.body.offsetHeight - 500) return;
      console.log("Near bottom, fetching more posts...");
      fetchPosts(false); // Fetch next page (will include token)
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll); // Cleanup listener
  }, [authLoading, loading, hasMore, fetchPosts]); // Include authLoading here


  // --- Filter Change Handler ---
  const handleFilterInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = event.target;
      const isCheckbox = type === 'checkbox';

      setFilters(prevFilters => ({
          ...prevFilters,
          // Use checked for checkboxes, value otherwise. Cast value for sortBy.
          [name]: isCheckbox ? (event.target as HTMLInputElement).checked : value as SortOption | string
      }));
      // The useEffect listening to `filters` will trigger the refetch
  };

  // --- Modal Handlers ---
  const openPostModal = (postId: string) => { if (!postId) { console.error("Invalid postId"); return; } setSelectedPostId(postId); setIsModalOpen(true); };
  const closePostModal = () => { setSelectedPostId(null); setIsModalOpen(false); };
  const handleCreatePostClick = () => { if (currentUser) { router.push('/community/create'); } else { setError('Please sign in to create a post.'); /* Or use a dedicated notification */ } };

  // --- Styles for Controls ---
  const controlBaseStyle = "h-9 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#0070F3] focus:border-[#0070F3] outline-none transition-colors text-black";
  const inputStyle = `${controlBaseStyle} px-3 py-1.5 placeholder-gray-400`;
  const selectStyle = `${controlBaseStyle} pl-9 pr-8 py-1.5 appearance-none bg-no-repeat bg-right`; // pl-9 for icon
  const checkboxStyle = "h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3] focus:ring-offset-1 disabled:opacity-50";
  const selectArrowStyle = { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundSize: `1.5em 1.5em`};

  // --- UI Render ---
  return (
    <div className="container mx-auto px-4 py-8 pt-20"> {/* Added pt-20 for fixed navbar */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-black">Community Feed</h1>
        {/* Show create button only if logged in (and auth resolved) */}
        {!authLoading && currentUser && (
          <button
            type="button"
            onClick={handleCreatePostClick}
            className="bg-[#0070F3] hover:bg-[#005bb5] text-white flex items-center px-4 py-2 rounded-md transition-colors shadow-sm text-sm font-medium flex-shrink-0" // Accent 1 Button
          >
            <PlusCircle className="mr-2" size={18} />
            Create Post
          </button>
        )}
      </div>

      {/* --- Filter Bar --- */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-sm border border-gray-200 py-3 px-4 mb-8 rounded-md shadow-sm">
        {/* Content inside filter bar */}
         <div className="container mx-auto flex flex-col sm:flex-row flex-wrap items-center gap-3 sm:gap-4">
          {/* Search Input */}
          <div className="w-full sm:w-auto sm:flex-grow lg:flex-grow-0 relative">
             <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              name="search"
              placeholder="Search posts..."
              value={filters.search}
              onChange={handleFilterInputChange}
              className={`${inputStyle} w-full sm:w-64 pl-9`} // pl-9 for icon
              // Disable search if not logged in? Optional.
              // disabled={authLoading || !currentUser}
            />
          </div>

          <div className="hidden lg:block flex-grow"></div> {/* Spacer */}

          {/* Category Select */}
          <div className="w-full sm:w-auto relative">
            <ListFilter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
                 name="category"
                 value={filters.category}
                 onChange={handleFilterInputChange}
                 className={`${selectStyle} w-full sm:w-auto`}
                 style={selectArrowStyle}
                 // disabled={authLoading || !currentUser}
            >
                <option value="">All Categories</option>
                {COMMUNITY_POST_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

           {/* My Posts Toggle */}
           <div className="w-full sm:w-auto">
               <label className="flex items-center space-x-2 cursor-pointer whitespace-nowrap py-1.5">
                   <input
                       type="checkbox"
                       name="showMyPosts"
                       checked={filters.showMyPosts}
                       onChange={handleFilterInputChange}
                       disabled={authLoading || !currentUser} // Disable if not logged in
                       className={checkboxStyle}
                   />
                    <span className={`text-sm ${!currentUser ? 'text-gray-400' : 'text-black'}`}>
                        My Posts
                    </span>
               </label>
           </div>

           {/* Sort Select */}
           <div className="w-full sm:w-auto relative">
               <SlidersHorizontal size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"/>
               <select
                   name="sortBy"
                   value={filters.sortBy}
                   onChange={handleFilterInputChange}
                   className={`${selectStyle} w-full sm:w-auto`}
                   style={selectArrowStyle}
                  //  disabled={authLoading || !currentUser}
               >
                   <option value="createdAt">Sort: Newest</option>
                   <option value="likesCount">Sort: Most Liked</option>
               </select>
           </div>
        </div>
      </div>
      {/* --- End Filter Bar --- */}


      {/* --- Main Content Area --- */}
      {authLoading ? (
        // Show a simple loading state while checking auth
        <div className="text-center mt-12 flex justify-center items-center text-gray-500">
             <Loader2 className="animate-spin mr-2" size={24} />
             <span>Checking authentication...</span>
        </div>
      ) : error ? (
        // Show error message if fetch failed or user not logged in
        <div className="text-center mt-12 text-red-600 bg-red-50 border border-red-200 rounded-md p-4 flex items-center justify-center gap-2">
            <AlertCircle size={20} />
            <span>{error}</span>
        </div>
      ) : loading && posts.length === 0 ? (
        // Initial loading state (after auth check)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {/* Placeholder for skeleton loaders */}
            <div className="h-64 bg-gray-200 rounded-md animate-pulse"></div>
            <div className="h-64 bg-gray-200 rounded-md animate-pulse hidden md:block"></div>
            <div className="h-64 bg-gray-200 rounded-md animate-pulse hidden lg:block"></div>
        </div>
      ) : posts.length === 0 ? (
         // No posts found message
         <div className="text-center mt-12 text-gray-500">
           No posts found matching your criteria.
         </div>
      ) : (
        // Display Post Grid
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {posts.map(post => (
                <CommunityPostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser} // Pass current user for like/delete checks etc.
                    onPostClick={() => openPostModal(post.id)}
                />
                ))}
            </div>

            {/* Loading Indicator for infinite scroll */}
            {loading && posts.length > 0 && ( // Show only when loading more
                <div className="text-center mt-8 flex justify-center items-center text-gray-500">
                <Loader2 className="animate-spin mr-2" size={20} />
                <span>Loading more posts...</span>
                </div>
            )}

            {/* "End of Feed" Message */}
            {!loading && !hasMore && posts.length > 0 && (
                <div className="text-center mt-12 text-gray-500">
                You've reached the end of the feed.
                </div>
            )}
        </>
      )}

      {/* Modal */}
      {isModalOpen && selectedPostId && (
        <Modal isOpen={isModalOpen} onClose={closePostModal}>
          <CommunityPostModal
            postId={selectedPostId}
            onClose={closePostModal}
            currentUser={currentUser} // Pass user to modal as well
          />
        </Modal>
      )}
    </div>
  );
}
