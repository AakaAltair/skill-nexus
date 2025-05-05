// components/CommunityPostModal.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { CommunityPost, CommunityComment } from '@/lib/types/community'; // Adjust paths
import { formatFullTimestamp } from '@/lib/dateUtils'; // Assuming you have this utility
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircle, Heart, CalendarDays, MapPin, Link as LinkIcon, Edit, Trash2, Send, Loader2, X } from 'lucide-react'; // Icons
import Image from 'next/image';
import firebaseApp from '@/app/firebase'; // Your client firebase instance (using default export)
import { getFirestore, doc, collection, query, orderBy, onSnapshot, deleteDoc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
// Use local auth state management if needed, or context if available
// import { useAuth } from '@/context/AuthContext'; // Remove if using local state pattern
import { User, getIdToken } from 'firebase/auth'; // Import User type and getIdToken
import { useRouter } from 'next/navigation';

// Get client Firestore instance
const db = getFirestore(firebaseApp);

const POSTS_COLLECTION_NAME = 'feedPosts';
const COMMENTS_SUBCOLLECTION_NAME = 'comments';
const LIKES_SUBCOLLECTION_NAME = 'likes';

// --- Comment Item Component (Simplified, with Timestamp) ---
interface CommentItemProps {
    comment: CommunityComment;
    currentUser: User | null; // Accept User or null
    postId: string;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, currentUser, postId }) => {
    const isOwner = currentUser && comment.creatorId === currentUser.uid;

    const handleDeleteComment = async () => {
        if (!confirm('Are you sure you want to delete this comment?')) return;
        try {
            const token = currentUser ? await currentUser.getIdToken() : null;
            if (!token) throw new Error("Authentication required");
            // Replace with your actual API call or direct delete + count logic
            const response = await fetch(`/api/community/posts/${postId}/comments/${comment.id}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) { const e = await response.json().catch(()=>{}); throw new Error(e.message || 'Failed'); }
            console.log('Comment deletion requested');
        } catch (error) { console.error('Error deleting comment:', error); alert('Failed delete.'); }
    };

    return (
        <div className="flex items-start space-x-2.5 mb-3"> {/* Reduced spacing */}
            <img src={comment.creatorPhotoURL || '/default_avatar.png'} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" width={32} height={32} />
            <div className="flex-1 min-w-0">
                <div className="bg-gray-100 rounded-lg px-3 py-1.5 mb-1 inline-block max-w-full">
                    {/* Name and **Timestamp** */}
                    <div className="flex items-baseline gap-2 mb-0.5 text-sm flex-wrap">
                        <span className="font-medium text-black whitespace-nowrap break-all">{comment.creatorName || 'Anonymous'}</span>
                        {/* Check if createdAt is valid before formatting */}
                        {comment.createdAt && comment.createdAt instanceof Timestamp && (
                            <span className="text-gray-500 text-xs whitespace-nowrap" title={comment.createdAt.toDate().toLocaleString()}>
                                {formatFullTimestamp(comment.createdAt)} {/* Display formatted timestamp */}
                            </span>
                        )}
                    </div>
                    {/* Text */}
                    <div className="text-sm text-black whitespace-pre-wrap break-words prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.text}</ReactMarkdown>
                    </div>
                </div>
                {/* Delete Button */}
                {isOwner && (
                    <div className="pl-1">
                         <button type="button" onClick={handleDeleteComment} className="p-1 rounded text-gray-500 hover:text-red-600 transition-colors text-xs" aria-label="Delete comment"><Trash2 size={14} /></button>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main Community Post Modal Component ---
interface CommunityPostModalProps {
  postId: string;
  onClose: () => void;
  currentUser: User | null; // Accept User or null
}

const API_BASE_URL = '/api/community/posts';

const CommunityPostModal: React.FC<CommunityPostModalProps> = ({ postId, onClose, currentUser }) => {
  const router = useRouter();

  // State remains largely the same as the working version
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]); // Simple comments array
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSubmissionError, setCommentSubmissionError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(0);

   // --- Fetch Post Details ---
   useEffect(() => {
     const fetchPost = async () => { setLoadingPost(true); setPostError(null); setIsLiked(false); setLocalLikeCount(0); try { const response = await fetch(`${API_BASE_URL}/${postId}`); if (!response.ok) { const d=await response.json().catch(()=>{}); throw new Error(d.message || `Failed (${response.status})`); } const data = await response.json(); const fetchedPost:CommunityPost=data.post; setPost(fetchedPost); setLocalLikeCount(fetchedPost.likesCount); if(currentUser && fetchedPost) { const likeRef=doc(db,POSTS_COLLECTION_NAME,fetchedPost.id,LIKES_SUBCOLLECTION_NAME,currentUser.uid); const snap=await getDoc(likeRef); setIsLiked(snap.exists()); } } catch(err){ console.error(`Fetch error:`,err); setPostError((err as Error).message); setPost(null); } finally { setLoadingPost(false); } };
     if(postId) fetchPost(); else { setPostError("Invalid Post ID"); setLoadingPost(false); }
   }, [postId, currentUser]);

  // --- Real-time Comments Listener ---
  useEffect(() => {
    if (!postId) return; setLoadingComments(true); setCommentsError(null);
    const commentsCollectionRef = collection(db, POSTS_COLLECTION_NAME, postId, COMMENTS_SUBCOLLECTION_NAME);
    const commentsQuery = query(commentsCollectionRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(commentsQuery,
      (snapshot) => {
        const fetchedComments: CommunityComment[] = snapshot.docs.map(doc => { const d = doc.data(); const ts=d.createdAt instanceof Timestamp ? d.createdAt : null; return { id: doc.id, ...d, createdAt: ts } as CommunityComment });
        setComments(fetchedComments); setLoadingComments(false);
      },
      (error) => { console.error(`Comments listener error:`, error); setCommentsError('Failed load comments.'); setLoadingComments(false); }
    );
    return () => unsubscribe();
  }, [postId]);

   // --- Handle Comment Submission ---
   const handlePostComment = async () => {
       if (!currentUser) { alert('Please sign in to comment.'); return; } if (!newCommentText.trim()) { alert('Comment cannot be empty.'); return; } if (!post) { alert('Cannot add comment.'); return; }
       setIsSubmittingComment(true); setCommentSubmissionError(null);
       try { const token=await currentUser.getIdToken(); const response=await fetch(`${API_BASE_URL}/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({ text: newCommentText.trim(), parentId: null }) }); if (!response.ok) { const d=await response.json().catch(()=>{}); throw new Error(d.message || 'Failed'); } setNewCommentText(''); } // Clear input on success
       catch (error) { console.error('Comment submit error:', error); setCommentSubmissionError((error as Error).message); }
       finally { setIsSubmittingComment(false); }
   };

   // --- Like/Edit/Delete Handlers ---
   const handleLikeToggle = async () => { if (!currentUser || !post) return; const ref=doc(db,POSTS_COLLECTION_NAME,post.id,LIKES_SUBCOLLECTION_NAME,currentUser.uid); try{ if(isLiked){await deleteDoc(ref);setIsLiked(false);setLocalLikeCount(p=>Math.max(0,p-1));}else{await setDoc(ref,{creatorId:currentUser.uid,likedAt:serverTimestamp()});setIsLiked(true);setLocalLikeCount(p=>p+1);} } catch(err){ console.error('Like error:',err); alert('Failed like.');} };
   const isPostCreator = post && currentUser && post.creatorId === currentUser.uid;
   const handleEditPost = () => { if (post) { router.push(`/community/${post.id}/edit`); onClose(); } };
   const handleDeletePost = async () => { if (!post || !confirm('Delete post?')) return; try { const token = currentUser ? await currentUser.getIdToken() : null; if (!token) throw new Error("Auth required"); const response = await fetch(`${API_BASE_URL}/${post.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) { const d=await response.json().catch(()=>{}); throw new Error(d.message || 'Failed'); } alert('Post deleted.'); onClose(); } catch(err){ console.error('Delete error:',err); alert('Failed delete.');} };

   // --- Render Media ---
   const renderMedia = () => { if (!post?.mediaUrls || post.mediaUrls.length === 0) return null; return (<div className={`grid gap-4 mb-4 ${post.mediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{post.mediaUrls.map((url, i) => (<div key={i} className="relative w-full h-48 md:h-64 lg:h-80 overflow-hidden rounded-md bg-gray-200">{url.startsWith('data:image') ? (<img src={url} alt={`Media ${i+1}`} className="absolute inset-0 w-full h-full object-cover" />) : (<Image src={url} alt={`Media ${i+1}`} layout="fill" objectFit="cover" className="rounded-md" unoptimized={true} />)}</div>))}</div>); };

  // --- Loading / Error States - These need to return JSX elements ---
  if (loadingPost) {
    return (<div className="p-6 text-center text-gray-500 flex justify-center items-center"><Loader2 className="animate-spin mr-2" size={24}/> Loading post...</div>);
  }
  if (postError || !post) {
    // It's better to render this within the standard modal structure for consistency,
    // or provide a way for the parent <Modal> to show errors.
    // For simplicity, let's show it directly here.
    return (<div className="p-6 text-center text-red-500 bg-white rounded-lg">Error loading post: {postError || 'Post not found.'} <br/> <button onClick={onClose} className="mt-2 text-sm text-blue-600 hover:underline">Close</button> </div>);
  }

  // --- Main Render Function for the Modal Content ---
  // This is the structure that was likely causing the parsing error before.
  // Ensure it's a single top-level element returned.
  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col"> {/* Flex Col Layout */}

      {/* Header (Shrink: 0) */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0 bg-white z-10">
         <div className="flex items-center min-w-0">
            <img src={post.creatorPhotoURL || '/default_avatar.png'} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" width={40} height={40} />
            <div className="ml-3 min-w-0">
               <p className="font-semibold text-black truncate">{post.creatorName || 'Anonymous'}</p>
               {post.createdAt && <p className="text-xs text-gray-500">{formatFullTimestamp(post.createdAt)}</p>}
            </div>
         </div>
         <div className="flex items-center flex-shrink-0 ml-2">
            {isPostCreator && (<>
               <button type="button" onClick={handleEditPost} className="p-1 rounded text-gray-600 hover:text-[#0070F3] hover:bg-gray-100 transition-colors mr-1" aria-label="Edit post"><Edit size={18} /></button>
               <button type="button" onClick={handleDeletePost} className="p-1 rounded text-gray-600 hover:text-red-600 hover:bg-gray-100 transition-colors mr-1" aria-label="Delete post"><Trash2 size={18} /></button>
            </>)}
            <button type="button" onClick={onClose} className="p-1 rounded text-gray-500 hover:text-black hover:bg-gray-100 transition-colors" aria-label="Close modal"><X size={20}/></button>
         </div>
      </div>

      {/* Scrollable Content Area (Grow: 1, Overflow: auto) */}
      <div className="flex-grow overflow-y-auto p-4">
        {/* Post Details */}
        {post.isEvent && post.eventDetails && (<div className="flex flex-wrap items-center text-[#FF4081] mb-4 text-base font-medium"><CalendarDays size={18} className="mr-2 flex-shrink-0" /><span className="mr-3">Event: {post.eventDetails.date ? formatFullTimestamp(post.eventDetails.date) : 'Date TBD'}{post.eventDetails.time && ` at ${post.eventDetails.time}`}</span>{post.eventDetails.location && (<span className="mr-3 flex items-center text-gray-600 text-sm font-normal"><MapPin size={16} className="mr-1 flex-shrink-0" /> {post.eventDetails.location}</span>)}{post.eventDetails.rsvpLink && (<a href={post.eventDetails.rsvpLink} target="_blank" rel="noopener noreferrer" className="text-[#0070F3] hover:underline flex items-center text-sm"><LinkIcon size={16} className="mr-1 flex-shrink-0" /> RSVP/Link</a>)}</div>)}
        <div className="mb-4 text-black text-base prose prose-sm sm:prose-base max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{post.textContent}</ReactMarkdown></div>
        {renderMedia()}
        {post.linkUrl && !post.hasMedia && (<a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="block text-[#0070F3] hover:underline text-sm mb-4 break-words"><LinkIcon size={14} className="inline-block mr-1" />{post.linkUrl}</a>)}
        {post.categories && post.categories.length > 0 && (<div className="flex flex-wrap gap-2 mb-4">{post.categories.map(cat => (<span key={cat} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">{cat}</span>))}</div>)}

        {/* Engagement Stats */}
        <div className="flex items-center text-gray-600 text-sm border-t border-gray-200 pt-4 mt-4">
            <button type="button" onClick={handleLikeToggle} className={`flex items-center mr-4 transition-colors ${isLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'}`} aria-label={isLiked ? 'Unlike' : 'Like'}><Heart size={20} fill={isLiked ? 'currentColor' : 'none'} className={`mr-1 ${isLiked ? 'animate-like-bounce' : ''}`} /><span>{localLikeCount}</span></button>
            {/* Use simple comments.length here */}
            <div className="flex items-center"><MessageCircle size={20} className="mr-1" /><span>{comments.length}</span></div>
        </div>

        {/* Comments List Area */}
        <div className="mt-8 border-t border-gray-200 pt-4 pb-4">
          <h3 className="text-lg font-semibold text-black mb-4">Comments ({comments.length})</h3>
          {/* Loading/Error/Empty States */}
          {loadingComments && comments.length === 0 && <div className="text-center text-gray-500 flex justify-center items-center"><Loader2 className="animate-spin mr-2" size={18} /> Loading comments...</div>}
          {commentsError && <p className="text-center text-red-500">{commentsError}</p>}
          {!loadingComments && comments.length === 0 && !commentsError && (<p className="text-center text-gray-600">No comments yet.</p>)}
          {/* List of Comments (using simple comments state) */}
          <div className="space-y-3">
            {comments.map(comment => (
              // Pass simplified props to CommentItem
              <CommentItem key={comment.id} comment={comment} currentUser={currentUser} postId={postId} />
            ))}
          </div>
        </div>
      </div> {/* End Scrollable Content Area */}

      {/* Bottom Comment Input Area (Shrink: 0) */}
      <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
        {currentUser ? (
          <div>
            {commentSubmissionError && (<p className="text-red-500 text-xs mb-2">{commentSubmissionError}</p>)}
            <textarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Add a comment..." rows={2} className="w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-[#0070F3] focus:ring focus:ring-[#0070F3] focus:ring-opacity-50 text-black mb-2 text-sm resize-none" />
            <button type="button" onClick={handlePostComment} disabled={!newCommentText.trim() || isSubmittingComment} className="w-full bg-[#0070F3] hover:bg-[#005bb5] text-white px-4 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex justify-center items-center text-sm font-medium"> {isSubmittingComment ? <Loader2 className="animate-spin" size={18} /> : 'Post'} </button>
          </div>
        ) : ( <p className="text-center text-xs text-gray-500 py-2">Please sign in to leave a comment.</p> )}
      </div>

    </div> // End Main Modal Container
  );
};

export default CommunityPostModal;