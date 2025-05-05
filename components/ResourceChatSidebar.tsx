// components/ResourceChatSidebar.tsx
"use client";

import React, { useState, useEffect, useRef, FormEvent, KeyboardEvent, useCallback, useMemo } from 'react';
import { ResourceComment } from '@/lib/types/resource'; // Use ResourceComment type
import { User, getIdToken } from 'firebase/auth';
import { formatTimestamp } from '@/lib/dateUtils'; // Ensure path is correct

// --- Props Interface ---
interface ResourceChatSidebarProps {
    resourceId: string;        // ID of the resource this chat belongs to
    resourceTitle: string;     // Title of the resource for the header
    currentUser: User | null; // Current logged-in user (or null)
    commentsEnabled: boolean; // Whether commenting is allowed
    isOpen: boolean;           // Controls if the sidebar is visible
    onClose: () => void;       // Function to call when closing the sidebar
}

// --- Interface for nested comments structure ---
interface NestedResourceComment extends ResourceComment {
    replies: NestedResourceComment[]; // Array to hold nested replies
}

// --- Helper Function to Build Nested Structure from flat comment list ---
function buildCommentTree(comments: ResourceComment[]): NestedResourceComment[] {
    const commentMap: { [id: string]: NestedResourceComment } = {};
    const nestedComments: NestedResourceComment[] = [];

    if (!comments || comments.length === 0) return [];

    // First pass: Create a map of comments by ID and initialize replies array
    comments.forEach(comment => {
        if (!comment?.id) { console.warn("Skipping comment without ID:", comment); return; };
        commentMap[comment.id] = { ...comment, replies: [] };
    });

    // Second pass: Iterate through the map and link replies to their parents
    Object.values(commentMap).forEach(comment => {
        if (comment.parentId && commentMap[comment.parentId]) {
            // Avoid duplicates if data somehow contains them
            if (!commentMap[comment.parentId].replies.some(reply => reply.id === comment.id)) {
                commentMap[comment.parentId].replies.push(comment);
            }
        } else if (!comment.parentId) { // It's a top-level comment
             // Check if top-level comment already exists
             if (!nestedComments.some(topLevel => topLevel.id === comment.id)) {
                nestedComments.push(comment);
            }
        }
    });

    // Sort top-level comments and their replies recursively by creation date (ascending)
    const sortByDate = (a: ResourceComment, b: ResourceComment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime();
    const sortReplies = (commentNode: NestedResourceComment) => {
        commentNode.replies.sort(sortByDate);
        commentNode.replies.forEach(sortReplies); // Recursively sort replies of replies
    };
    nestedComments.sort(sortByDate);
    nestedComments.forEach(sortReplies);

    return nestedComments;
}


// --- Recursive Comment Item Component ---
interface ResourceCommentItemProps {
    comment: NestedResourceComment; // The comment data to display
    currentUser: User | null;      // Current user for context
    resourceId: string;           // Resource ID
    level: number;                 // Indentation level
    commentsEnabled: boolean;      // Is commenting allowed?
    // Props for handling replies
    isPostingReply: boolean;
    replyText: string;
    onReplyTextChange: (text: string) => void;
    onReplySubmit: (e?: FormEvent | KeyboardEvent) => void;
    onReplyCancel: () => void;
    onReplyKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    isReplyingToThis: boolean;
    onSetReplyTarget: (parentId: string | null) => void;
    replyError: string | null;
}

const ResourceCommentItem: React.FC<ResourceCommentItemProps> = ({
    comment, currentUser, resourceId, level, commentsEnabled,
    isPostingReply, replyText, onReplyTextChange, onReplySubmit, onReplyCancel, onReplyKeyDown,
    isReplyingToThis, onSetReplyTarget, replyError
}) => {
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

    // --- Effect for Auto-resizing Reply Textarea & Focusing ---
     useEffect(() => {
        if (isReplyingToThis && replyTextareaRef.current) {
             const textarea = replyTextareaRef.current;
             textarea.style.height = 'auto'; // Reset height
             const scrollHeight = textarea.scrollHeight;
             const maxHeight = 80; // Max height before scrolling
             textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
             textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
             textarea.focus();
        }
    }, [replyText, isReplyingToThis]);

    // --- Styling Variables ---
    const inputStyle = "w-full bg-gray-50 border border-gray-300 rounded-md px-2 py-1 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition duration-150 resize-none disabled:opacity-60"; // Focus style added
    const replyButtonStyle = "px-3 py-1 bg-cyan-600 text-white text-xs font-medium rounded-md shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[50px]"; // Slightly larger padding, min-width
    const cancelButtonStyle = "px-3 py-1 bg-white text-gray-700 border border-gray-300 text-xs font-medium rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50";


    return (
        // Container for a single comment item + its potential reply form
        <div className="flex gap-2.5 items-start w-full">
             {/* Author Avatar */}
             <img
                 src={comment.authorPhotoURL || '/default-avatar.png'}
                 alt={`${comment.authorName || 'User'}'s avatar`}
                 className="w-7 h-7 rounded-full border border-gray-200 flex-shrink-0 mt-0.5"
                 loading="lazy"
            />
             {/* Comment Bubble and Actions Container */}
             <div className="flex-grow min-w-0">
                 {/* Bubble containing comment text */}
                 <div className="bg-gray-100 border border-gray-200/80 rounded-lg rounded-tl-none px-3 py-1.5 mb-1 inline-block max-w-full">
                    {/* Header: Author, Time */}
                    <div className="flex items-baseline gap-2 mb-0.5 text-sm flex-wrap">
                        <span className="font-medium text-gray-900 whitespace-nowrap">{comment.authorName}</span>
                        <span className="text-gray-500 text-xs whitespace-nowrap" title={new Date(comment.createdAt.toString()).toLocaleString()}>
                            {formatTimestamp(comment.createdAt.toString())}
                        </span>
                    </div>
                    {/* Text content */}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{comment.text}</p>
                 </div>
                 {/* Actions below bubble: Reply Button */}
                 {currentUser && commentsEnabled && (
                     <div className="pl-1 flex items-center gap-3">
                         <button
                            onClick={() => onSetReplyTarget(isReplyingToThis ? null : comment.id!)}
                            disabled={isPostingReply && isReplyingToThis}
                            className="flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-cyan-600 font-medium transition-colors disabled:text-gray-300 disabled:no-underline p-0 bg-transparent border-none cursor-pointer"
                         >
                            {/* Reply Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.902 4.064A1.5 1.5 0 0 1 6 3.75h5.25c.414 0 .75.336.75.75v2.25a.75.75 0 0 1-1.5 0V5.25H6.31a.75.75 0 0 0-.707.443l-1 2A.75.75 0 0 0 5.25 9h3.5a.75.75 0 0 1 0 1.5h-4a2.25 2.25 0 0 1-2.096-1.33L1.402 6.33a.75.75 0 0 1 .95-.813l1.855.618A1.5 1.5 0 0 1 4.902 4.064Z" clipRule="evenodd" /></svg>
                            {isReplyingToThis ? 'Cancel' : 'Reply'}
                         </button>
                     </div>
                 )}
             </div>

             {/* --- Reply Input Form --- */}
             {isReplyingToThis && currentUser && (
                    <div className="w-full mt-2 pl-[calc(1.75rem+0.625rem)]"> {/* Indent reply form */}
                        <form onSubmit={onReplySubmit} className="flex gap-2 items-start">
                            <img src={currentUser.photoURL || '/default-avatar.png'} alt="Your avatar" className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0 mt-1"/>
                            <div className="flex-grow flex flex-col">
                                <textarea
                                    ref={replyTextareaRef}
                                    value={replyText}
                                    onChange={(e) => onReplyTextChange(e.target.value)}
                                    onKeyDown={onReplyKeyDown}
                                    placeholder={`Replying to ${comment.authorName}...`}
                                    rows={1}
                                    required
                                    autoFocus
                                    className={`${inputStyle} text-xs py-1 mb-1`}
                                    style={{ maxHeight: '80px' }}
                                    disabled={isPostingReply}
                                />
                                {/* Reply Buttons & Error */}
                                <div className="flex justify-end items-center gap-2 mt-1">
                                    {replyError && <p className='text-xs text-red-600 mr-auto'>Error: {replyError}</p>}
                                    <button type="button" onClick={onReplyCancel} disabled={isPostingReply} className={cancelButtonStyle}>Cancel</button>
                                    <button type="submit" disabled={isPostingReply || !replyText.trim()} className={replyButtonStyle}>
                                        {/* Loading spinner */}
                                        {isPostingReply ? (<svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V..." className="opacity-75" fill="currentColor"></path></svg>) : null}
                                        {isPostingReply ? '...' : 'Reply'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}
        </div>
    );
};


// --- Main Resource Chat Sidebar Component ---
const ResourceChatSidebar: React.FC<ResourceChatSidebarProps> = ({
    resourceId, resourceTitle, currentUser, commentsEnabled, isOpen, onClose
}) => {
    // --- State ---
    const [allComments, setAllComments] = useState<ResourceComment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isPostingReply, setIsPostingReply] = useState(false);
    const [replyPostError, setReplyPostError] = useState<string | null>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null); // For auto-scrolling
    const textareaRef = useRef<HTMLTextAreaElement>(null); // For main input auto-resize

    // --- Fetch Comments Effect ---
    useEffect(() => {
        if (!isOpen || !resourceId) return; // Only fetch when open and ID is valid
        let isMounted = true;
        const fetchComments = async () => {
            console.log(`Fetching comments for resource ${resourceId}`);
            setIsLoading(true); setError(null); setAllComments([]);
            try {
                const response = await fetch(`/api/resources/${resourceId}/comments`);
                if (!isMounted) return;
                if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `Fetch failed (${response.status})`); }
                const data = await response.json();
                if (isMounted) {
                    if (data.comments && Array.isArray(data.comments)) {
                        const sorted = data.comments.sort((a: ResourceComment, b: ResourceComment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime());
                        setAllComments(sorted);
                    } else { setAllComments([]); }
                }
            } catch (err: any) { if (isMounted) setError(err.message || "Could not load comments."); }
            finally { if (isMounted) setIsLoading(false); }
        };
        fetchComments();
        return () => { isMounted = false; }; // Cleanup
    }, [isOpen, resourceId]);

    // --- Build Nested Comment Tree ---
    const nestedCommentTree = useMemo(() => buildCommentTree(allComments), [allComments]);

    // --- Scroll & Resize Effects ---
    useEffect(() => { /* Scroll to bottom logic */
        if (isOpen && !isLoading && messagesEndRef.current) {
            const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, 150);
            return () => clearTimeout(timer);
        }
     }, [nestedCommentTree, isOpen, isLoading]);

    useEffect(() => { /* Main textarea resize logic */
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 100;
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
     }, [newMessageText]);

     // --- Refetch Comments Function ---
     const refetchComments = useCallback(async () => {
        if (!resourceId) return;
        console.log(`Refetching resource comments for ${resourceId}...`);
        setError(null);
        try {
            const response = await fetch(`/api/resources/${resourceId}/comments`);
            if (!response.ok) { throw new Error(`Refetch failed (${response.status})`); }
            const data = await response.json();
            if (data.comments && Array.isArray(data.comments)) {
                const sorted = data.comments.sort((a: ResourceComment, b: ResourceComment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime());
                setAllComments(sorted);
            } else { setAllComments([]); }
        } catch (err: any) { console.error("Refetch error:", err); setError(err.message || "Failed to refresh comments."); }
    }, [resourceId]);

    // --- Generic Post Message Function ---
    const handlePostMessage = useCallback(async ( text: string, parentId: string | null, onSuccess: () => void, setIsPostingState: React.Dispatch<React.SetStateAction<boolean>>, setErrorState: React.Dispatch<React.SetStateAction<string | null>> ) => {
        if (!currentUser || !commentsEnabled || !text.trim()) return;
        setIsPostingState(true); setErrorState(null); onSuccess();
        try {
            const idToken = await getIdToken(currentUser, true);
            const response = await fetch(`/api/resources/${resourceId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify({ text: text.trim(), parentId }) });
            if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `Post failed (${response.status})`); }
            await refetchComments(); // Refetch the list on success
        } catch (err: any) { console.error("Error posting resource comment:", err); setErrorState(err.message || "Could not send message."); }
        finally { setIsPostingState(false); }
    }, [currentUser, commentsEnabled, resourceId, refetchComments]);

    // --- Specific Event Handlers ---
    const handlePostTopLevel = (e?: FormEvent | KeyboardEvent) => { e?.preventDefault(); handlePostMessage(newMessageText, null, () => setNewMessageText(''), setIsPosting, setPostError); };
    const handlePostReply = (e?: FormEvent | KeyboardEvent) => { e?.preventDefault(); handlePostMessage(replyText, replyingTo, () => { setReplyText(''); setReplyingTo(null); }, setIsPostingReply, setReplyPostError); };
    const handleMainKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && newMessageText.trim()) handlePostTopLevel(e); };
    const handleReplyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && replyText.trim()) handlePostReply(e); };
    const handleSetReplyTarget = (commentId: string | null) => { setReplyingTo(commentId); setReplyText(''); setReplyPostError(null); setPostError(null); };
    const handleCancelReply = () => { setReplyingTo(null); setReplyText(''); setReplyPostError(null); };

    // --- Recursive Renderer Function ---
    const renderComments = useCallback((commentsToRender: NestedResourceComment[], level = 0): JSX.Element[] => {
        const maxIndentLevel = 4;
        const currentIndentLevel = Math.min(level, maxIndentLevel);
        const indentationClass = level === 0 ? '' : `ml-${currentIndentLevel * 3}`; // e.g., ml-0, ml-3, ml-6...

        return commentsToRender.map(comment => (
            <div key={comment.id} className={`w-full ${level > 0 ? `pl-3 border-l-2 border-gray-200/70 ${indentationClass}` : ''}`}> {/* Slightly lighter border for indent */}
                <ResourceCommentItem
                    comment={comment}
                    currentUser={currentUser}
                    resourceId={resourceId!}
                    level={level}
                    commentsEnabled={commentsEnabled}
                    isPostingReply={isPostingReply}
                    replyText={replyText}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={handlePostReply}
                    onReplyCancel={handleCancelReply}
                    onReplyKeyDown={handleReplyKeyDown}
                    isReplyingToThis={replyingTo === comment.id}
                    onSetReplyTarget={handleSetReplyTarget}
                    replyError={replyingTo === comment.id ? replyPostError : null}
                />
                {comment.replies?.length > 0 && (
                    <div className="mt-3 space-y-3"> {/* Spacing for nested replies */}
                        {renderComments(comment.replies, level + 1)}
                    </div>
                )}
            </div>
        ));
    }, [currentUser, resourceId, commentsEnabled, replyingTo, isPostingReply, replyText, handlePostReply, handleCancelReply, handleReplyKeyDown, handleSetReplyTarget, replyPostError]); // Dependencies


    // --- Styling Variables ---
    // Adjusted positioning: fixed top-16 (assuming 4rem/64px navbar), calculated height
    // Increased max-width slightly for wider screens if desired
    const sidebarClasses = `fixed top-16 right-0 h-[calc(100vh-4rem)] bg-white border-l border-gray-200 shadow-xl z-40 transition-transform duration-300 ease-in-out flex flex-col w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl`;
    const inputStyle = "flex-grow bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition duration-150 resize-none disabled:opacity-60";
    const sendButtonStyle = `p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-cyan-500 transition duration-150`;

    // --- Render Sidebar ---
    return (
        // Apply translation based on isOpen state for slide-in/out effect
        <div className={`${sidebarClasses} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white h-16"> {/* Explicit height */}
                 <h3 className="text-base font-semibold text-gray-900 truncate pr-2" title={resourceTitle}> Resource Chat </h3>
                 {/* Close Button - Always visible within the header */}
                 <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-100 transition-colors" title="Close chat">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                 </button>
            </div>

            {/* Message Display Area */}
            <div className="flex-grow p-4 space-y-3 overflow-y-auto bg-gray-50/50"> {/* Light background for message area */}
                 {/* Loading State */}
                 {isLoading && <p className="text-center text-gray-500 text-sm py-4">Loading chat...</p>}
                 {/* Error State */}
                 {!isLoading && error && <p className="text-center text-red-600 text-sm py-4 border border-red-100 bg-red-50 rounded-md px-2">Error: {error}</p>}
                 {/* Empty State */}
                 {!isLoading && !error && nestedCommentTree.length === 0 && ( <p className="text-center text-gray-400 text-sm py-6 italic">No comments yet. Start the conversation!</p> )}
                 {/* Render comment tree */}
                 {!isLoading && !error && renderComments(nestedCommentTree)}
                 {/* Empty div at the end to help scrollIntoView target the bottom */}
                 <div ref={messagesEndRef} />
            </div>

            {/* Message Input Area (Bottom) */}
            <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                 {/* Conditional rendering based on commentsEnabled and currentUser */}
                 {commentsEnabled ? (
                    currentUser ? (
                        // Logged-in and comments enabled: Show input form
                        <form onSubmit={handlePostTopLevel} className="flex gap-2 items-end">
                             <textarea
                                 ref={textareaRef} // Ref for auto-resizing
                                 value={newMessageText}
                                 onChange={(e) => setNewMessageText(e.target.value)}
                                 onKeyDown={handleMainKeyDown} // Handle Enter key
                                 className={inputStyle}
                                 placeholder="Type a message..."
                                 rows={1} // Start as single line
                                 style={{ maxHeight: '100px' }} // Limit height growth
                                 disabled={isPosting || isLoading} // Disable during posting/loading
                                 required
                             />
                             <button
                                type="submit"
                                className={sendButtonStyle}
                                disabled={isPosting || isLoading || !newMessageText.trim()} // Disable if posting or empty
                                title="Send message (Enter)"
                             >
                                {/* Send Icon or Loading Spinner */}
                                {isPosting ?
                                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M2.87 2.298a.75.75 0 0 0-.812 1.03l3.596 7.233-3.596 7.233a.75.75 0 0 0 .812 1.03l11.25-4.5a.75.75 0 0 0 0-1.062l-11.25-4.5Z" /></svg> }
                             </button>
                         </form>
                     ) : (
                        // Logged out, comments enabled: Show login prompt
                        <p className="text-center text-xs text-gray-500 py-2">Please log in to participate in the chat.</p>
                    )
                 ) : (
                    // Comments disabled: Show disabled message
                    <p className="text-center text-xs text-gray-500 py-2 italic">Chat is disabled for this resource.</p>
                 )}
                  {/* Display top-level posting error if not currently replying */}
                  {(postError && !replyingTo) && <p className="text-xs text-red-600 mt-1 text-center">Error: {postError}</p>}
                  {/* Reply-specific errors are shown inline within the ResourceCommentItem */}
            </div>
        </div>
    );
};

export default ResourceChatSidebar;