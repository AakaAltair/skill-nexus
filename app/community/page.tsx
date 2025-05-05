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
import { PlusCircle, Loader2, Search, ListFilter, SlidersHorizontal } from 'lucide-react'; // Icons

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
    });
    return () => unsubscribe();
  }, [auth, filters.showMyPosts]); // Re-check if showMyPosts was true

  // --- Fetch Posts Function ---
  const fetchPosts = useCallback(async (isInitialFetch = true) => {
    // Prevent fetching if already loading or no more posts (unless initial)
    if ((loading && !isInitialFetch) || (!hasMore && !isInitialFetch)) return;

    setLoading(true);
    if (isInitialFetch) setError(null);

    // Build URL with filters and sorting
    let url = `${API_BASE_URL}?limit=15&sortBy=${filters.sortBy}`;
    if (filters.category) url += `&category=${encodeURIComponent(filters.category)}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`; // NOTE: Backend search needs implementation
    if (filters.showMyPosts && currentUser?.uid) { // Ensure currentUser exists before accessing uid
         url += `&userId=${currentUser.uid}`;
    }
    if (!isInitialFetch && lastDocId) url += `&lastDocId=${lastDocId}`;

    try {
      console.log(`Fetching posts from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(()=>({message: `API Error ${response.status}`}));
        if (isInitialFetch) throw new Error(errorData.message || `Failed to fetch posts (${response.status})`);
        else { console.warn("Failed to fetch more posts:", errorData.message); setHasMore(false); }
      } else {
        const data = await response.json(); const fetchedPosts: CommunityPost[] = data.posts;
        setPosts(prevPosts => isInitialFetch ? fetchedPosts : [...prevPosts, ...fetchedPosts]);
        setHasMore(fetchedPosts.length === 15); // Assume more if limit is reached
        if (fetchedPosts.length > 0) { setLastDocId(fetchedPosts[fetchedPosts.length - 1].id); }
        else if (isInitialFetch) { setLastDocId(null); }
      }
    } catch (err) {
      console.error('Fetch posts error:', err);
      if (isInitialFetch) setError((err as Error).message);
      setHasMore(false);
    } finally { setLoading(false); }
  }, [filters, lastDocId, hasMore, currentUser?.uid, loading]); // Add loading to prevent concurrent fetches

  // --- Effect for Initial Fetch / Filter Change ---
  useEffect(() => {
    // Only fetch if auth state is determined
    if (!authLoading) {
      console.log("Auth loaded or Filters changed, triggering fetch:", filters);
      setPosts([]); // Reset posts when filters change
      setLastDocId(null); // Reset pagination cursor
      setHasMore(true); // Assume there might be more posts with new filters
      fetchPosts(true); // Trigger the fetch
    }
  // Depend on the filters object and authLoading status
  // currentUser.uid is included to refetch if user logs in/out AND showMyPosts is checked
  }, [authLoading, filters, currentUser?.uid]);

  // --- Effect for Infinite Scroll ---
  useEffect(() => {
    const handleScroll = () => {
      // Don't fetch if already loading, no more posts, or not near bottom
      if (loading || !hasMore || window.innerHeight + window.scrollY < document.body.offsetHeight - 500) return;
      console.log("Near bottom, fetching more posts...");
      fetchPosts(false); // Fetch next page
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll); // Cleanup listener
  }, [loading, hasMore, fetchPosts]); // fetchPosts dependency is okay here

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
  const handleCreatePostClick = () => { if (currentUser) { router.push('/community/create'); } else { alert('Please sign in to create a post.'); } };

  // --- Styles for Controls ---
  const controlBaseStyle = "h-9 text-sm bg-white border border-gray-300 rounded-md focus:ring-1 focus:ring-[#0070F3] focus:border-[#0070F3] outline-none transition-colors text-black";
  const inputStyle = `${controlBaseStyle} px-3 py-1.5 placeholder-gray-400`;
  const selectStyle = `${controlBaseStyle} pl-9 pr-8 py-1.5 appearance-none bg-no-repeat bg-right`; // pl-9 for icon
  const checkboxStyle = "h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3] focus:ring-offset-1 disabled:opacity-50";
  const selectArrowStyle = { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundSize: `1.5em 1.5em`};

  return (
    // Inherits background from layout body
    <div className="container mx-auto px-4 py-8 pt-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-black">Community Feed</h1>
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
                 className={`${selectStyle} w-full sm:w-auto`} // pl-9 already included in selectStyle base
                 style={selectArrowStyle}
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
                       disabled={authLoading || !currentUser}
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
                   className={`${selectStyle} w-full sm:w-auto`} // pl-9 already included in selectStyle base
                   style={selectArrowStyle}
               >
                   <option value="createdAt">Sort: Newest</option>
                   <option value="likesCount">Sort: Most Liked</option>
               </select>
           </div>
        </div>
      </div>
      {/* --- End Filter Bar --- */}

      {/* Display initial loading error */}
      {error && posts.length === 0 && !loading && (
        <p className="text-red-500 text-center mb-4 mt-8">{error}</p>
      )}

      {/* Post Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {/* Render cards only if not initial loading or if there's an error but some posts were loaded before */}
         {!loading && posts.length === 0 && !error ? null : posts.map(post => (
          <CommunityPostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            onPostClick={() => openPostModal(post.id)}
          />
        ))}
        {/* Show skeleton loaders during initial load? (Optional enhancement) */}
         {loading && posts.length === 0 && !error && (
             <> {/* Placeholder for skeleton loaders */}
                 <div className="h-64 bg-gray-200 rounded-md animate-pulse"></div>
                 <div className="h-64 bg-gray-200 rounded-md animate-pulse hidden md:block"></div>
                 <div className="h-64 bg-gray-200 rounded-md animate-pulse hidden lg:block"></div>
             </>
         )}
      </div>

      {/* Loading Indicator for infinite scroll */}
      {loading && posts.length > 0 && ( // Only show spinner if posts already exist
        <div className="text-center mt-8 flex justify-center items-center text-gray-500">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span>Loading more posts...</span>
        </div>
      )}

      {/* "No Posts" / "End of Feed" Messages */}
      {!loading && posts.length === 0 && !error && (
        <div className="text-center mt-12 text-gray-500">
          No posts found matching your criteria.
        </div>
      )}
      {!loading && !hasMore && posts.length > 0 && (
        <div className="text-center mt-12 text-gray-500">
          You've reached the end of the feed.
        </div>
      )}

      {/* Modal */}
      {isModalOpen && selectedPostId && (
        <Modal isOpen={isModalOpen} onClose={closePostModal}>
          <CommunityPostModal
            postId={selectedPostId}
            onClose={closePostModal}
            currentUser={currentUser}
          />
        </Modal>
      )}
    </div>
  );
}