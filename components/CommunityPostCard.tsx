// components/CommunityPostCard.tsx
"use client";

import { CommunityPost } from '@/lib/types/community';
// Import necessary formatters and Timestamp type
import { formatSimpleDate } from '@/lib/dateUtils';
import { Timestamp } from 'firebase/firestore'; // Make sure Timestamp is imported
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircle, Heart, CalendarDays, MapPin, Link as LinkIcon } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import firebaseApp from '@/app/firebase'; // Ensure this path is correct
import { getFirestore, doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const db = getFirestore(firebaseApp);

interface CommunityPostCardProps {
  post: CommunityPost;
  currentUser: any; // Or your specific Firebase User type
  onPostClick: () => void;
}

const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  currentUser,
  onPostClick,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  // Initialize localLikeCount safely, defaulting to 0 if post.likesCount is undefined/null
  const [localLikeCount, setLocalLikeCount] = useState(post.likesCount ?? 0);

  // --- Helper function to check if a date is valid ---
  const isValidDate = (date: string | Timestamp | Date | undefined | null): boolean => {
      if (!date) return false;
      try {
          // If it's a Firestore Timestamp object
          if (date instanceof Timestamp) {
              // Check if seconds is a valid number (basic check)
              return typeof date.seconds === 'number' && !isNaN(date.seconds);
          }
          // If it's already a Date object
          if (date instanceof Date) {
              return !isNaN(date.getTime());
          }
          // If it's a string, try parsing
          if (typeof date === 'string') {
              // Add basic check for common invalid date strings from inputs if necessary
              if (date === '' || date === 'Invalid Date') return false;
              return !isNaN(Date.parse(date));
          }
      } catch {
          return false; // Error during conversion/check means invalid
      }
      return false; // Default to invalid if type not recognized
  }

  // --- Effect to check like status ---
  useEffect(() => {
    const checkLikeStatus = async () => {
        if (!currentUser || !post.id) { setIsLiked(false); return; }
        const likeRef = doc(db, 'feedPosts', post.id, 'likes', currentUser.uid);
        try { const snap = await getDoc(likeRef); setIsLiked(snap.exists()); }
        catch (err){ console.error("Like check error:", err); setIsLiked(false); }
    };
    checkLikeStatus();
  }, [currentUser, post.id]);

  // --- Like toggle handler ---
  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) { alert('Sign in to like.'); return; }
    if (!post || !post.id) { console.error("Post or Post ID missing for like toggle"); return; } // Added check
    const likeRef = doc(db, 'feedPosts', post.id, 'likes', currentUser.uid);
    try {
        if (isLiked) {
            await deleteDoc(likeRef);
            setIsLiked(false);
            setLocalLikeCount(p => Math.max(0, p - 1));
        } else {
            await setDoc(likeRef, { creatorId: currentUser.uid, likedAt: serverTimestamp() });
            setIsLiked(true);
            setLocalLikeCount(p => p + 1);
        }
    } catch (err) {
        console.error("Like toggle error:", err);
        alert('Action failed. Please try again.'); // Generic error for user
    }
  };

  // --- Render Media ---
  const renderMedia = () => {
    if (!post.mediaUrls || post.mediaUrls.length === 0) return null;
    const url = post.mediaUrls[0]; // Only show first image on card
    // Basic check if it looks like a Data URL (might need adjustment)
    const isDataUrl = url.startsWith('data:image');

    return (
        <div className="relative w-full h-48 bg-gray-100 rounded-t-lg overflow-hidden">
            {isDataUrl ? (
                 <img
                     src={url}
                     alt="Post media" // Improved alt text
                     className="w-full h-full object-cover"
                 />
            ) : (
                 <Image
                     src={url}
                     alt="Post media" // Improved alt text
                     layout="fill"
                     objectFit="cover"
                     unoptimized={true} // May still be needed depending on source
                     onError={(e) => { console.warn(`Failed to load image: ${url}`); (e.target as HTMLImageElement).style.display='none'; }} // Hide on error
                 />
            )}
        </div>
    );
};


  // --- Determine date display logic ---
  const isActualEvent = post.isEvent === true && post.eventDetails && isValidDate(post.eventDetails.date);
  const dateToShow = isActualEvent ? post.eventDetails!.date : post.createdAt;
  const isDateValidForDisplay = isValidDate(dateToShow); // Check if the selected date is valid

  return (
    // Card container
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 ease-in-out flex flex-col overflow-hidden cursor-pointer"
      onClick={onPostClick}
    >
      {renderMedia()}
      <div className="p-4 flex flex-col flex-grow">
        {/* Creator Info */}
        <div className="flex items-center mb-3">
             <img src={post.creatorPhotoURL || '/default_avatar.png'} alt={post.creatorName || 'User Avatar'} width={32} height={32} className="rounded-full mr-3 object-cover" />
             <div className="flex-grow min-w-0"> {/* Added min-w-0 */}
                 <p className="font-medium text-sm text-black truncate">{post.creatorName || 'Anonymous'}</p>
                 {/* --- Render the determined date if valid --- */}
                 {isDateValidForDisplay ? (
                    <p className="text-gray-500 text-xs">
                        {/* Add "Event on:" prefix only if it's a valid event */}
                        {isActualEvent && <span className="font-medium text-[#FF4081]">Event on: </span>}
                        {/* Format the date using formatSimpleDate */}
                        {formatSimpleDate(dateToShow)}
                        {/* Append time if it's a valid event and time exists */}
                        {isActualEvent && post.eventDetails!.time && ` at ${post.eventDetails!.time}`}
                    </p>
                 ) : (
                    // Fallback if neither event date nor createdAt is valid
                    <p className="text-gray-400 text-xs italic">No date</p>
                 )}
            </div>
        </div>

        {/* Optional: Show Event Location on Card */}
        {isActualEvent && post.eventDetails!.location && (
             <div className="flex items-center text-gray-600 mb-3 text-xs mt-[-4px]"> {/* Negative margin to pull up slightly */}
                 <MapPin size={14} className="mr-1.5 flex-shrink-0" />
                 <span className="truncate">{post.eventDetails!.location}</span>
             </div>
        )}

        {/* Post Content */}
        <div className="mb-4 text-black text-sm flex-grow line-clamp-4 prose prose-sm max-w-none">
             <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.textContent}</ReactMarkdown>
        </div>

        {/* Categories/Tags */}
        {post.categories && post.categories.length > 0 && ( <div className="flex flex-wrap gap-1.5 mb-3">{post.categories.map(cat => (<span key={cat} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{cat}</span>))}</div> )}

        {/* Link */}
        {post.linkUrl && ( <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="block text-[#0070F3] hover:underline text-sm truncate mb-4" onClick={(e) => e.stopPropagation()}><LinkIcon size={14} className="inline-block mr-1" />{post.linkUrl}</a> )}

        {/* Actions Footer */}
        <div className="flex items-center mt-auto pt-3 border-t border-gray-100">
            {/* Like Button */}
            <button type="button" onClick={handleLikeToggle} className={`flex items-center text-sm mr-4 transition-colors ${isLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'}`} aria-label={isLiked ? 'Unlike' : 'Like'}> <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} className={`mr-1 ${isLiked ? 'animate-like-bounce' : ''}`} /> <span>{localLikeCount}</span> </button>
            {/* Comment Count */}
            <div className="flex items-center text-gray-500 text-sm"> <MessageCircle size={16} className="mr-1" /> <span>{post.commentCount ?? 0}</span> </div>{/* Safely access commentCount */}
        </div>
      </div>
    </div>
  );
};

export default CommunityPostCard;