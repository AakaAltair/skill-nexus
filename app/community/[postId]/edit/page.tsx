// app/community/[postId]/edit/page.tsx
"use client";

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation'; // Use useParams to get postId
import { User, getAuth, getIdToken, onAuthStateChanged } from 'firebase/auth';
import firebaseApp from '@/app/firebase';
import { CommunityPost, COMMUNITY_POST_CATEGORIES } from '@/lib/types/community';
import { Loader2, ImagePlus, Link as LinkIcon, CalendarDays, X } from 'lucide-react';
import { format } from 'date-fns'; // For formatting date input

const MAX_FILE_SIZE_MB = 5;
const MAX_TOTAL_SIZE_MB = 15;
const MAX_FILES = 5;

export default function EditCommunityPostPage() {
  const router = useRouter();
  const params = useParams(); // Hook to get route parameters
  const postId = params?.postId as string; // Extract postId
  const auth = getAuth(firebaseApp);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postData, setPostData] = useState<CommunityPost | null>(null); // Store fetched post data
  const [loadingPost, setLoadingPost] = useState(true); // Loading state for initial fetch

  // Form State - Initialize empty, will be populated by useEffect
  const [textContent, setTextContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isEvent, setIsEvent] = useState(false);
  const [eventDetails, setEventDetails] = useState({ date: '', time: '', location: '', rsvpLink: '' });
  const [categories, setCategories] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]); // For new uploads
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]); // Existing + new previews
  const [initialMediaUrls, setInitialMediaUrls] = useState<string[]>([]); // Track original URLs

  // --- Authentication and Initial Data Fetch ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        if (postId) {
          fetchPostData(user, postId); // Fetch data only after getting user and postId
        }
      } else {
        router.push('/community?notice=login_required');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth, router, postId]); // Add postId dependency

  // --- Function to Fetch Existing Post Data ---
  const fetchPostData = useCallback(async (user: User, currentPostId: string) => {
    setLoadingPost(true);
    setError(null);
    try {
      const token = await getIdToken(user);
      const response = await fetch(`/api/community/posts/${currentPostId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 404) throw new Error('Post not found.');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch post (${response.status})`);
      }

      const data = await response.json();
      const fetchedPost: CommunityPost = data.post;

      // Authorization Check: Ensure current user is the creator
      if (fetchedPost.creatorId !== user.uid) {
        throw new Error('You are not authorized to edit this post.');
        // Or redirect: router.push('/community?notice=unauthorized'); return;
      }

      setPostData(fetchedPost);

      // --- Populate Form State ---
      setTextContent(fetchedPost.textContent || '');
      setLinkUrl(fetchedPost.linkUrl || '');
      setIsEvent(fetchedPost.isEvent || false);
      if (fetchedPost.isEvent && fetchedPost.eventDetails) {
         // Format date correctly for <input type="date"> which expects 'YYYY-MM-DD'
         const eventDate = fetchedPost.eventDetails.date ? format(new Date((fetchedPost.eventDetails.date as any).seconds * 1000), 'yyyy-MM-dd') : '';
         setEventDetails({
            date: eventDate,
            time: fetchedPost.eventDetails.time || '',
            location: fetchedPost.eventDetails.location || '',
            rsvpLink: fetchedPost.eventDetails.rsvpLink || '',
         });
      } else {
          setEventDetails({ date: '', time: '', location: '', rsvpLink: '' }); // Reset if not event
      }
      setCategories(fetchedPost.categories || []);
      // IMPORTANT: Existing media URLs are treated as previews initially.
      // Only Data URLs generated from NEW files will be sent for saving in the temporary setup.
      // In a real setup, you'd handle deleting old Storage files and uploading new ones.
      const existingMedia = fetchedPost.mediaUrls || [];
      setMediaPreviews(existingMedia);
      setInitialMediaUrls(existingMedia); // Store original URLs for comparison/deletion later if needed
      // mediaFiles state remains empty initially for new uploads.

    } catch (err) {
      console.error('Error fetching post for edit:', err);
      setError((err as Error).message);
      setPostData(null); // Clear data on error
    } finally {
      setLoadingPost(false);
    }
  }, [router]); // router included for potential redirects

  // --- Media Handling (Similar to Create Page, but adds to existing previews) ---
   const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
     const files = event.target.files;
     if (!files) return;

     let currentFiles = [...mediaFiles]; // Only NEW files go here
     let currentPreviews = [...mediaPreviews]; // All previews (existing + new)
     let currentTotalSize = mediaFiles.reduce((sum, file) => sum + file.size, 0) + initialMediaUrls.length * 500000; // Estimate existing size roughly for demo limit

     const newFiles = Array.from(files).filter(file => {
        // Combine existing previews + new files for count limit
        if (currentPreviews.length + (currentFiles.length + 1) > MAX_FILES) {
            alert(`You can upload a maximum of ${MAX_FILES} files in total.`);
            return false;
        }
         if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { alert(`File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`); return false; }
         if (currentTotalSize + file.size > MAX_TOTAL_SIZE_MB * 1024 * 1024) { alert(`Adding file "${file.name}" would exceed the total upload limit of ${MAX_TOTAL_SIZE_MB}MB.`); return false; }
         if (!file.type.startsWith('image/')) { alert(`File "${file.name}" is not a supported image type.`); return false; }
         currentTotalSize += file.size;
         return true;
     });

     if (newFiles.length === 0) return;

     currentFiles = [...currentFiles, ...newFiles];
     setMediaFiles(currentFiles); // Add *new* File objects

     newFiles.forEach(file => {
       const reader = new FileReader();
       reader.onloadend = () => { if (typeof reader.result === 'string') { setMediaPreviews(prev => [...prev, reader.result as string]); } }; // Add *new* Data URL previews
       reader.onerror = (error) => { console.error("FileReader error:", error); alert(`Could not read file "${file.name}"`); }
       reader.readAsDataURL(file);
     });
      event.target.value = '';
   };

   const removeMedia = (indexToRemove: number, isExisting: boolean) => {
       const urlToRemove = mediaPreviews[indexToRemove];
       setMediaPreviews(prev => prev.filter((_, index) => index !== indexToRemove));

       // If removing an *existing* URL, just remove from preview.
       // If removing a *newly added* preview, remove from mediaFiles state too.
       // This logic is complex without proper Storage handling. For demo, we just remove the preview.
       // In real app: mark the initialMediaUrl for deletion on submit, remove corresponding file from mediaFiles if new.

        // Simplified demo logic: just remove the preview.
        // A proper implementation needs to track which previews correspond to initialMediaUrls
        // vs which ones correspond to newly added mediaFiles.
   };

  // --- Category Handling (Same as Create) ---
   const handleCategoryToggle = (category: string) => { setCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); };

  // --- Form Submission (PATCH Request) ---
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !postData) { setError('User or post data missing.'); return; }
    if (!textContent.trim()) { setError('Post content cannot be empty.'); return; }
    if (isEvent && !eventDetails.date) { setError('Event must have a date.'); return; }

    setIsSubmitting(true);
    setError(null);

    // --- Determine Changed Fields ---
    const changes: any = {};
    if (textContent.trim() !== postData.textContent) changes.textContent = textContent.trim();
    if ((linkUrl.trim() || null) !== (postData.linkUrl || null)) changes.linkUrl = linkUrl.trim() || null; // Handle empty strings as null
    if (isEvent !== postData.isEvent) changes.isEvent = isEvent;

    // Compare event details (handle potential nulls/undefined carefully)
    const currentEventDetailsPayload = isEvent ? {
        date: eventDetails.date, // Send string, API converts
        time: eventDetails.time || null,
        location: eventDetails.location.trim() || null,
        rsvpLink: eventDetails.rsvpLink.trim() || null,
      } : null;
    const originalEventDetailsPayload = postData.isEvent ? {
        date: postData.eventDetails?.date ? format(new Date((postData.eventDetails.date as any).seconds * 1000), 'yyyy-MM-dd') : '',
        time: postData.eventDetails?.time || null,
        location: postData.eventDetails?.location || null,
        rsvpLink: postData.eventDetails?.rsvpLink || null,
    } : null;
    // Basic JSON stringify comparison (might need deep comparison for complex objects)
    if (JSON.stringify(currentEventDetailsPayload) !== JSON.stringify(originalEventDetailsPayload)) {
        changes.eventDetails = currentEventDetailsPayload;
    }


    // Compare categories (simple length check + includes for demo, robust check needed for order changes)
    if (categories.length !== (postData.categories?.length ?? 0) || !categories.every(cat => postData.categories?.includes(cat))) {
        changes.categories = categories.length > 0 ? categories : null;
    }

    // **Media Handling (Temporary Demo Logic):**
    // Send the *entire current* preview list. The backend PATCH should just overwrite.
    // A real implementation would diff initialMediaUrls vs current mediaPreviews,
    // figure out which were deleted (to delete from Storage), and upload only *new* files.
    if (JSON.stringify(mediaPreviews) !== JSON.stringify(initialMediaUrls)) {
        changes.mediaUrls = mediaPreviews.length > 0 ? mediaPreviews : null;
    }

    // If no changes detected, don't submit
    if (Object.keys(changes).length === 0) {
        setError('No changes detected.');
        setIsSubmitting(false);
        return;
    }

    console.log("Submitting Changes:", changes);

    try {
      const token = await getIdToken(currentUser);
      const response = await fetch(`/api/community/posts/${postId}`, {
        method: 'PATCH', // Use PATCH for updates
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(changes), // Send only changed fields
      });

      if (!response.ok) {
        const errorData = await response.json().catch(()=>({message: "An unknown error occurred."}));
        throw new Error(errorData.message || 'Failed to update post');
      }

      console.log("Post updated successfully");
      // Redirect back to feed (or maybe the post view if you have one)
      router.push('/community?notice=post_updated');

    } catch (err) {
      console.error('Error updating post:', err);
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  // --- Loading / Auth Check / Not Found ---
  if (authLoading || loadingPost) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="animate-spin" size={32} /></div>;
  }
  // Handle case where fetch failed (post not found, unauthorized, etc.)
  if (error && !postData) {
      return <div className="text-center p-10 text-red-600">{error} <br/><br/> <button onClick={() => router.push('/community')} className="text-sm text-blue-600 hover:underline">Go back to Feed</button></div>;
  }
   if (!currentUser || !postData) {
       // Should be caught by auth check or fetch error, but as a fallback
       return <div className="text-center p-10">Could not load post data or user information.</div>;
   }

  // --- Render Edit Form (Very similar to Create Form) ---
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 pt-24">
      <h1 className="text-3xl font-bold text-black mb-6">Edit Post</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Text Content */}
        <div>
          <label htmlFor="textContent" className="block text-sm font-medium text-black mb-1"> Content <span className="text-red-500">*</span> </label>
          <textarea id="textContent" value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={6} required className="w-full rounded-md border border-gray-300 shadow-sm p-3 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black text-base" />
        </div>

        {/* Media Upload */}
        <div>
            <label className="block text-sm font-medium text-black mb-2">Manage Photos</label>
            {/* Display Existing + New Previews */}
            {mediaPreviews.length > 0 && (
                <div className="mb-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {mediaPreviews.map((previewUrl, index) => (
                         <div key={previewUrl + index} className="relative group aspect-square"> {/* Use URL + index for key */}
                            <img src={previewUrl} alt={`Preview ${index + 1}`} className="object-cover w-full h-full rounded-md border border-gray-200" />
                            <button type="button" onClick={() => removeMedia(index, initialMediaUrls.includes(previewUrl))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image"> <X size={14} /> </button>
                         </div>
                    ))}
                </div>
            )}
            {/* Upload Area (only if not max files) */}
            {mediaPreviews.length < MAX_FILES && (
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                   <div className="space-y-1 text-center">
                      <ImagePlus className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-[#0070F3] hover:text-[#005bb5] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#0070F3]">
                          <span>Add more files</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleMediaChange} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">Max {MAX_FILES - mediaPreviews.length} more files. Up to {MAX_FILE_SIZE_MB}MB each.</p>
                   </div>
                </div>
            )}
        </div>

        {/* Optional Link */}
        <div>
           <label htmlFor="linkUrl" className="block text-sm font-medium text-black mb-1 flex items-center gap-1"> <LinkIcon size={16} /> Optional Link URL </label>
           <input type="url" id="linkUrl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" />
        </div>

        {/* Event Details */}
        <div>
          <div className="flex items-center mb-3">
            <input id="isEvent" type="checkbox" checked={isEvent} onChange={(e) => setIsEvent(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3]" />
            <label htmlFor="isEvent" className="ml-2 block text-sm font-medium text-black"> This post is an Event </label>
          </div>
          {isEvent && ( /* Render inputs same as create page */
            <div className="space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label htmlFor="eventDate" className="block text-sm font-medium text-black mb-1"> Event Date <span className="text-red-500">*</span> </label>
                   <input type="date" id="eventDate" required={isEvent} value={eventDetails.date} onChange={(e) => setEventDetails({...eventDetails, date: e.target.value})} className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" />
                 </div>
                 <div>
                   <label htmlFor="eventTime" className="block text-sm font-medium text-black mb-1">Event Time (Optional)</label>
                   <input type="time" id="eventTime" value={eventDetails.time} onChange={(e) => setEventDetails({...eventDetails, time: e.target.value})} className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" />
                 </div>
              </div>
              <div> <label htmlFor="eventLocation" className="block text-sm font-medium text-black mb-1">Location (Optional)</label> <input type="text" id="eventLocation" value={eventDetails.location} onChange={(e) => setEventDetails({...eventDetails, location: e.target.value})} placeholder="e.g., College Auditorium, Online (Zoom)" className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" /> </div>
              <div> <label htmlFor="rsvpLink" className="block text-sm font-medium text-black mb-1">RSVP/Info Link (Optional)</label> <input type="url" id="rsvpLink" value={eventDetails.rsvpLink} onChange={(e) => setEventDetails({...eventDetails, rsvpLink: e.target.value})} placeholder="https://link-to-register-or-more-info.com" className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" /> </div>
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
           <label className="block text-sm font-medium text-black mb-2">Categories (Optional)</label>
           <div className="flex flex-wrap gap-2">
               {COMMUNITY_POST_CATEGORIES.map(cat => ( <button key={cat} type="button" onClick={() => handleCategoryToggle(cat)} className={`px-3 py-1 rounded-full text-sm border transition-colors ${ categories.includes(cat) ? 'bg-[#0070F3] text-white border-[#0070F3]' : 'bg-white text-black border-gray-300 hover:border-gray-400' }`} > {cat} </button> ))}
           </div>
        </div>

        {/* Submission Area */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-end">
          {error && ( <p className="text-red-600 text-sm text-center sm:text-left sm:mr-auto">{error}</p> )}
           <button type="button" onClick={() => router.back()} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50" >
               Cancel
           </button>
          <button type="submit" disabled={isSubmitting || authLoading || loadingPost || !textContent.trim()} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors" >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}