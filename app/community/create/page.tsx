// app/community/create/page.tsx
"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
// --- Corrected Firebase Auth Imports ---
import { User, getAuth, getIdToken, onAuthStateChanged } from 'firebase/auth'; // Added onAuthStateChanged
import firebaseApp from '@/app/firebase';
// --- Other Imports ---
import { COMMUNITY_POST_CATEGORIES } from '@/lib/types/community'; // Import categories
import { Loader2, ImagePlus, Link as LinkIcon, CalendarDays, X } from 'lucide-react'; // Icons

const MAX_FILE_SIZE_MB = 5; // Max size per file for temporary demo
const MAX_TOTAL_SIZE_MB = 15; // Max total size for all files
const MAX_FILES = 5; // Max number of files allowed

export default function CreateCommunityPostPage() {
  const router = useRouter();
  const auth = getAuth(firebaseApp);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [textContent, setTextContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isEvent, setIsEvent] = useState(false);
  const [eventDetails, setEventDetails] = useState({ date: '', time: '', location: '', rsvpLink: '' });
  const [categories, setCategories] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);

  // Check authentication and redirect if not logged in
  useEffect(() => {
    // Now onAuthStateChanged is correctly imported
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        // Redirect to login or community feed if not logged in
        router.push('/community?notice=login_required'); // Redirect back to feed with notice
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth, router]);

  // --- Media Handling ---
  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    let currentFiles = [...mediaFiles];
    let currentPreviews = [...mediaPreviews];
    let currentTotalSize = mediaFiles.reduce((sum, file) => sum + file.size, 0);
    const newFiles = Array.from(files).filter(file => {
        if (currentFiles.length >= MAX_FILES) { alert(`Max ${MAX_FILES} files.`); return false; }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { alert(`File "${file.name}" > ${MAX_FILE_SIZE_MB}MB.`); return false; }
        if (currentTotalSize + file.size > MAX_TOTAL_SIZE_MB * 1024 * 1024) { alert(`Adding "${file.name}" exceeds total ${MAX_TOTAL_SIZE_MB}MB limit.`); return false; }
        if (!file.type.startsWith('image/')) { alert(`"${file.name}" is not an image.`); return false; }
        currentTotalSize += file.size;
        return true;
    });
    if (newFiles.length === 0) return;
    currentFiles = [...currentFiles, ...newFiles];
    setMediaFiles(currentFiles);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => { if (typeof reader.result === 'string') { setMediaPreviews(prev => [...prev, reader.result as string]); } };
      reader.onerror = (error) => { console.error("FileReader error:", error); alert(`Could not read file "${file.name}"`); }
      reader.readAsDataURL(file);
    });
     event.target.value = '';
  };

  const removeMedia = (indexToRemove: number) => {
    setMediaFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    setMediaPreviews(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // --- Category Handling ---
   const handleCategoryToggle = (category: string) => { setCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]); };

  // --- Form Submission ---
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) { setError('Authentication error.'); return; }
    if (!textContent.trim()) { setError('Post content cannot be empty.'); return; }
    if (isEvent && !eventDetails.date) { setError('Event must have a date.'); return; }
    setIsSubmitting(true); setError(null);
    const postData = {
      textContent: textContent.trim(),
      linkUrl: linkUrl.trim() || null,
      isEvent: isEvent,
      eventDetails: isEvent ? { date: eventDetails.date, time: eventDetails.time || null, location: eventDetails.location.trim() || null, rsvpLink: eventDetails.rsvpLink.trim() || null } : null,
      categories: categories.length > 0 ? categories : null,
      mediaUrls: mediaPreviews.length > 0 ? mediaPreviews : null, // Sending Data URLs
    };
    console.log("Submitting Post Data:", { ...postData, mediaUrls: `[${mediaPreviews.length} Data URLs]` });
    try {
      const token = await getIdToken(currentUser);
      const response = await fetch('/api/community/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(postData) });
      if (!response.ok) { const errorData = await response.json().catch(()=>({message: "An unknown error occurred."})); throw new Error(errorData.message || 'Failed to create post'); }
      const result = await response.json();
      console.log("Post created successfully:", result);
      router.push('/community?notice=post_created');
    } catch (err) {
      console.error('Error creating post:', err);
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  // --- Loading / Auth Check ---
  if (authLoading) { return <div className="flex justify-center items-center min-h-screen"><Loader2 className="animate-spin" size={32} /></div>; }
  if (!currentUser) { return <div className="text-center p-10">Redirecting... You must be logged in to create a post.</div>; }

  // --- Render Form ---
  return (
    // Using standard HTML elements styled with Tailwind
    <div className="container mx-auto max-w-3xl px-4 py-8 pt-24">
      <h1 className="text-3xl font-bold text-black mb-6">Create New Post</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Text Content */}
        <div>
          <label htmlFor="textContent" className="block text-sm font-medium text-black mb-1"> What's on your mind? <span className="text-red-500">*</span> </label>
          <textarea id="textContent" value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={6} required placeholder="Share an update, ask a question, announce an event..." className="w-full rounded-md border border-gray-300 shadow-sm p-3 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black text-base" />
        </div>
        {/* Media Upload */}
        <div>
           <label className="block text-sm font-medium text-black mb-2">Add Photos (Optional)</label>
           <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                 <ImagePlus className="mx-auto h-12 w-12 text-gray-400" />
                 <div className="flex text-sm text-gray-600"><label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-[#0070F3] hover:text-[#005bb5] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#0070F3]"><span>Upload files</span><input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleMediaChange} /></label><p className="pl-1">or drag and drop</p></div>
                 <p className="text-xs text-gray-500">PNG, JPG, GIF up to {MAX_FILE_SIZE_MB}MB each. Max {MAX_FILES} files, {MAX_TOTAL_SIZE_MB}MB total.</p>
              </div>
           </div>
            {mediaPreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {mediaPreviews.map((previewUrl, index) => ( <div key={index} className="relative group aspect-square"><img src={previewUrl} alt={`Preview ${index + 1}`} className="object-cover w-full h-full rounded-md border border-gray-200" /><button type="button" onClick={() => removeMedia(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image"><X size={14} /></button></div> ))}
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
          <div className="flex items-center mb-3"><input id="isEvent" type="checkbox" checked={isEvent} onChange={(e) => setIsEvent(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3]" /><label htmlFor="isEvent" className="ml-2 block text-sm font-medium text-black"> This post is an Event </label></div>
          {isEvent && (
            <div className="space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><label htmlFor="eventDate" className="block text-sm font-medium text-black mb-1"> Event Date <span className="text-red-500">*</span> </label><input type="date" id="eventDate" required={isEvent} value={eventDetails.date} onChange={(e) => setEventDetails({...eventDetails, date: e.target.value})} className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" /></div>
                 <div><label htmlFor="eventTime" className="block text-sm font-medium text-black mb-1">Event Time (Optional)</label><input type="time" id="eventTime" value={eventDetails.time} onChange={(e) => setEventDetails({...eventDetails, time: e.target.value})} className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black" /></div>
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
        <div className="pt-4 border-t border-gray-200">
          {error && ( <p className="text-red-600 text-sm mb-4 text-center">{error}</p> )}
          <button type="submit" disabled={isSubmitting || authLoading || !textContent.trim()} className="w-full flex justify-center items-center px-6 py-2.5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors" >
            {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 mr-3" /> : null}
            {isSubmitting ? 'Creating Post...' : 'Create Post'}
          </button>
        </div>
      </form>
    </div>
  );
}