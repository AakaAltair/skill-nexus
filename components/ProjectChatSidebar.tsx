// components/ProjectChatSidebar.tsx
"use client";

import React, { useState, useEffect, useRef, FormEvent, KeyboardEvent, useCallback, useMemo } from 'react';
import { Comment } from '@/lib/types/project'; // Use Comment type for messages
import { User, getIdToken } from 'firebase/auth';
import { formatTimestamp } from '@/lib/dateUtils'; // Use our date formatter

// --- Props Interface ---
interface ProjectChatSidebarProps {
    projectId: string;
    projectTitle: string; // For context in the sidebar header
    currentUser: User | null;
    commentsEnabled: boolean; // Pass the enabled status
    isOpen: boolean; // Control visibility from parent
    onClose: () => void; // Function to close the sidebar
}

// --- Interface for nested comments ---
interface NestedComment extends Comment {
    replies: NestedComment[]; // Array to hold nested replies
}

// --- Helper Function to Build Nested Structure ---
function buildCommentTree(comments: Comment[]): NestedComment[] {
    const commentMap: { [id: string]: NestedComment } = {};
    const nestedComments: NestedComment[] = [];

    if (!comments || comments.length === 0) return [];

    // First pass: Create map and add replies array, ensure ID exists
    comments.forEach(comment => {
        if (!comment?.id) {
            console.warn("Skipping comment without ID:", comment);
            return;
        };
        commentMap[comment.id] = { ...comment, replies: [] };
    });

    // Second pass: Link replies to their parents
    Object.values(commentMap).forEach(comment => {
        if (comment.parentId && commentMap[comment.parentId]) {
             if (!commentMap[comment.parentId].replies.some(reply => reply.id === comment.id)) {
                commentMap[comment.parentId].replies.push(comment);
             }
        } else if (!comment.parentId) { // Only add true top-level comments
            if (!nestedComments.some(topLevel => topLevel.id === comment.id)) {
                nestedComments.push(comment);
            }
        }
    });

    // Sort top-level and replies by date (ascending)
    const sortByDate = (a: Comment, b: Comment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime();
    const sortReplies = (commentNode: NestedComment) => {
        commentNode.replies.sort(sortByDate);
        commentNode.replies.forEach(sortReplies);
    };
    nestedComments.sort(sortByDate);
    nestedComments.forEach(sortReplies);

    return nestedComments;
}


// --- Recursive Comment Item Component ---
interface CommentItemProps {
    comment: NestedComment;
    currentUser: User | null;
    projectId: string;
    level: number;
    isPostingReply: boolean;
    replyText: string;
    onReplyTextChange: (text: string) => void;
    onReplySubmit: (e?: FormEvent | KeyboardEvent) => void;
    onReplyCancel: () => void;
    onReplyKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    isReplyingToThis: boolean;
    onSetReplyTarget: (parentId: string | null) => void;
    replyError: string | null; // Accept reply error state
    commentsEnabled: boolean; // Needed to show reply button
}

const CommentItem: React.FC<CommentItemProps> = ({
    comment, currentUser, projectId, level,
    isPostingReply, replyText, onReplyTextChange, onReplySubmit, onReplyCancel, onReplyKeyDown,
    isReplyingToThis, onSetReplyTarget, replyError, commentsEnabled
}) => {
    const isCurrentUserAuthor = currentUser?.uid === comment.authorId;
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize Reply Textarea & focus
     useEffect(() => {
        if (isReplyingToThis) {
             const textarea = replyTextareaRef.current;
             if (textarea) {
                 textarea.style.height = 'auto';
                 const scrollHeight = textarea.scrollHeight;
                 const maxHeight = 80;
                 textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
                 textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
                 textarea.focus();
             }
        }
    }, [replyText, isReplyingToThis]);

    // Styling Variables
    const inputStyle = "w-full bg-violet border border-purple-300 rounded-md px-2 py-1 text-sm placeholder-gray-400 text-black outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition duration-150 resize-none disabled:opacity-60";
    const replyButtonStyle = "px-1.5 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";
    const cancelButtonStyle = "px-3 py-1 bg-white text-gray-700 border border-gray-300 text-xs font-medium rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50";


    return (
        // Container for a single comment item + its potential reply form
        <div className="flex gap-2.5 items-start w-full">
             {/* Author Avatar */}
             <img src={comment.authorPhotoURL || '/default-avatar.png'} alt={comment.authorName} className="w-7 h-7 rounded-full border flex-shrink-0 mt-0.5"/>
             {/* Comment Bubble and Actions Container */}
             <div className="flex-grow min-w-0">
                 {/* Bubble containing comment text */}
                 <div className="bg-gray-50 border border-gray-200/80 rounded-lg rounded-tl-none px-3 py-1.5 mb-1 inline-block max-w-full">
                    {/* Header: Author, Time */}
                    <div className="flex items-baseline gap-2 mb-0.5 text-sm flex-wrap">
                        <span className="font-medium text-black whitespace-nowrap">{comment.authorName}</span>
                        <span className="text-gray-500 text-xs whitespace-nowrap" title={new Date(comment.createdAt.toString()).toLocaleString()}>
                            {formatTimestamp(comment.createdAt.toString())}
                        </span>
                    </div>
                    {/* Text */}
                    <p className="text-sm text-black whitespace-pre-wrap break-words">{comment.text}</p>
                 </div>
                 {/* Actions below bubble */}
                 {/* Show Reply button only if logged in AND comments are enabled */}
                 {currentUser && commentsEnabled && (
                     <div className="pl-1 flex items-center gap-3">
                         <button
                            onClick={() => onSetReplyTarget(isReplyingToThis ? null : comment.id!)} // Toggle reply input
                            disabled={isPostingReply && isReplyingToThis}
                            className="flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-blue-600 font-medium transition-colors disabled:text-gray-300 disabled:no-underline p-0 bg-transparent border-none cursor-pointer" // Refined subtle style
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.902 4.064A1.5 1.5 0 0 1 6 3.75h5.25c.414 0 .75.336.75.75v2.25a.75.75 0 0 1-1.5 0V5.25H6.31a.75.75 0 0 0-.707.443l-1 2A.75.75 0 0 0 5.25 9h3.5a.75.75 0 0 1 0 1.5h-4a2.25 2.25 0 0 1-2.096-1.33L1.402 6.33a.75.75 0 0 1 .95-.813l1.855.618A1.5 1.5 0 0 1 4.902 4.064Z" clipRule="evenodd" /></svg>
                            {isReplyingToThis ? 'Cancel' : 'Reply'}
                         </button>
                         {/* Placeholder for Delete Button */}
                     </div>
                 )}
             </div>

             {/* --- Reply Input Form --- */}
             {isReplyingToThis && currentUser && (
                    <div className="w-full mt-2"> {/* Renders below the parent comment */}
                        <form onSubmit={onReplySubmit} className="flex gap-2 items-start">
                            <img src={currentUser.photoURL || '/default-avatar.png'} alt="You" className="w-6 h-6 rounded-full border flex-shrink-0 mt-1"/>
                            <div className="flex-grow flex flex-col">
                                <textarea
                                    ref={replyTextareaRef}
                                    value={replyText}
                                    onChange={(e) => onReplyTextChange(e.target.value)}
                                    onKeyDown={onReplyKeyDown}
                                    placeholder={`Replying to ${comment.authorName}...`}
                                    rows={1} required autoFocus
                                    className={`${inputStyle} text-xs py-1 mb-1`}
                                    style={{ maxHeight: '80px' }}
                                    disabled={isPostingReply}
                                />
                                {/* Reply Buttons & Error */}
                                <div className="flex justify-end items-center gap-2 mt-1">
                                    {/* Use replyError prop passed down */}
                                    {replyError && <p className='text-xs text-red-600 mr-auto'>Error: {replyError}</p>}
                                    <button type="button" onClick={onReplyCancel} disabled={isPostingReply} className={cancelButtonStyle}>Cancel</button>
                                    <button type="submit" disabled={isPostingReply || !replyText.trim()} className={replyButtonStyle}>
                                        {isPostingReply ? (<svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" className="opacity-25"></circle><path d="M4 8a4 4 0 014-4V2a6 6 0 00-6 6h2z" className="opacity-75" fill="currentColor"></path></svg>) : null}
                                        {isPostingReply ? '...' : 'Reply'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}
        </div> // End comment item container
    );
};


// --- Main Sidebar Component ---
const ProjectChatSidebar: React.FC<ProjectChatSidebarProps> = ({
    projectId, projectTitle, currentUser, commentsEnabled, isOpen, onClose
}) => {
    // --- State ---
    const [allComments, setAllComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newMessageText, setNewMessageText] = useState(''); // Top-level input state
    const [isPosting, setIsPosting] = useState(false);         // Top-level posting state
    const [postError, setPostError] = useState<string | null>(null); // Top-level error state
    const [replyingTo, setReplyingTo] = useState<string | null>(null); // ID of comment being replied to
    const [replyText, setReplyText] = useState(''); // Text for the active reply input
    const [isPostingReply, setIsPostingReply] = useState(false); // Separate loading for replies
    const [replyPostError, setReplyPostError] = useState<string | null>(null); // Separate error for replies

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // --- Fetch ALL Comments ---
    useEffect(() => {
        if (!isOpen || !projectId) return;
        let isMounted = true;
        async function fetchComments() {
            setIsLoading(true); setError(null); setAllComments([]);
            try {
                const response = await fetch(`/api/projects/${projectId}/comments`);
                if (!isMounted) return;
                if (!response.ok) { const d=await response.json().catch(()=>{}); throw new Error(d.error||`Fetch failed (${response.status})`); }
                const data = await response.json();
                if (isMounted) {
                    if (data.comments && Array.isArray(data.comments)) {
                        const sorted = data.comments.sort((a: Comment, b: Comment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime());
                        setAllComments(sorted);
                    } else { setAllComments([]); }
                }
            } catch (err: any) { if (isMounted) setError(err.message || "Could not load comments."); }
            finally { if (isMounted) setIsLoading(false); }
        }
        fetchComments();
        return () => { isMounted = false; };
    }, [isOpen, projectId]);

    // --- Build Nested Tree ---
    const nestedCommentTree = useMemo(() => buildCommentTree(allComments), [allComments]);

    // --- Scroll/Resize Effects ---
    useEffect(() => { // Scroll to bottom
        if (isOpen && !isLoading) {
             const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 150);
             return () => clearTimeout(timer);
        }
    }, [nestedCommentTree, isOpen, isLoading]);

    useEffect(() => { // Resize main textarea
        const textarea = textareaRef.current;
        if (textarea) { /* ... resize logic ... */ }
    }, [newMessageText]);

     // --- Refetch Function ---
     const refetchComments = useCallback(async () => {
        if (!projectId) return;
        console.log(`Refetching comments for ${projectId}...`);
        // No loading indicator for refetch to make it smoother
        try {
            const response = await fetch(`/api/projects/${projectId}/comments`);
            if (!response.ok) { throw new Error("Refetch failed"); }
            const data = await response.json();
            if (data.comments && Array.isArray(data.comments)) {
                const sorted = data.comments.sort((a: Comment, b: Comment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime());
                setAllComments(sorted); // Update state with fresh data
            } else { setAllComments([]); }
            setError(null); // Clear fetch errors on successful refetch
        } catch (err: any) {
            console.error("Refetch error:", err);
            setError(err.message || "Failed to refresh comments."); // Show error if refetch fails
        }
    }, [projectId]);

    // --- Generic Post Message Function (using refetch on success) ---
    const handlePostMessage = useCallback(async ( text: string, parentId: string | null, onSuccess: () => void, setIsPostingState: React.Dispatch<React.SetStateAction<boolean>>, setErrorState: React.Dispatch<React.SetStateAction<string | null>> ) => {
        if (!currentUser || !commentsEnabled || !text) return;
        setIsPostingState(true); setErrorState(null);
        onSuccess(); // Clear input immediately

        try {
            const idToken = await getIdToken(currentUser, true);
            const response = await fetch(`/api/projects/${projectId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }, body: JSON.stringify({ text, parentId }) });
            if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || `Post failed (${response.status})`); }

            console.log("Post successful, refetching comments...");
            await refetchComments(); // Refetch the entire comment list

        } catch (err: any) {
            setErrorState(err.message || "Could not send message.");
            // No need to rollback optimistic update as we removed it
        } finally {
            setIsPostingState(false);
        }
    }, [currentUser, commentsEnabled, projectId, refetchComments]); // Added refetchComments

    // --- Specific Handlers ---
    const handlePostTopLevel = (e?: FormEvent | KeyboardEvent) => { e?.preventDefault(); handlePostMessage(newMessageText.trim(), null, () => setNewMessageText(''), setIsPosting, setPostError); };
    const handlePostReply = (e?: FormEvent | KeyboardEvent) => { e?.preventDefault(); handlePostMessage(replyText.trim(), replyingTo, () => { setReplyText(''); setReplyingTo(null); }, setIsPostingReply, setReplyPostError); };
    const handleMainKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) handlePostTopLevel(e); };
    const handleReplyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) handlePostReply(e); };
    const handleSetReplyTarget = (commentId: string | null) => { setReplyingTo(commentId); setReplyText(''); setReplyPostError(null); setPostError(null); }; // Clear both errors
    const handleCancelReply = () => { setReplyingTo(null); setReplyText(''); setReplyPostError(null); };

    // --- Recursive Renderer (Updated Indentation/Border) ---
    const renderComments = useCallback((commentsToRender: NestedComment[], level = 0): JSX.Element[] => {
        const maxIndentLevel = 4; // Max visual indent level
        const currentIndentLevel = Math.min(level, maxIndentLevel);
         // Calculate margin/padding based on level
        const indentationClass = level === 0 ? '' : `ml-${[0, 3, 6, 9, 12][currentIndentLevel]}`; // Example: ml-3, ml-6...

        return commentsToRender.map(comment => (
            // Each comment + replies is wrapped
            <div key={comment.id} className={`w-full ${level > 0 ? `pl-3 border-l-2 border-gray-200 ${indentationClass}` : ''}`}> {/* Darker border + margin */}
                <CommentItem
                    comment={comment}
                    currentUser={currentUser}
                    projectId={projectId}
                    level={level}
                    onSetReplyTarget={handleSetReplyTarget}
                    isReplyingToThis={replyingTo === comment.id}
                    isPostingReply={isPostingReply}
                    replyText={replyText}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={handlePostReply}
                    onReplyCancel={handleCancelReply}
                    onReplyKeyDown={handleReplyKeyDown}
                    replyError={replyingTo === comment.id ? replyPostError : null} // Pass down reply-specific error
                    commentsEnabled={commentsEnabled} // Pass down enabled status
                />
                {/* Recursive call for replies */}
                {comment.replies?.length > 0 && (
                    <div className="mt-3 space-y-3"> {/* Consistent spacing for replies */}
                        {renderComments(comment.replies, level + 1)}
                    </div>
                )}
            </div>
        ));
    // Update dependencies
    }, [currentUser, projectId, replyingTo, isPostingReply, replyText, handlePostReply, handleCancelReply, handleReplyKeyDown, handleSetReplyTarget, replyPostError, commentsEnabled]);


    // --- Styling Variables ---
    const sidebarClasses = `fixed top-20 right-0 h-205 bg-white border-l border-indigo-200 shadow-xl z-40 transition-transform duration-300 ease-in-out flex flex-col pt- w-full max-w-md sm:max-w-lg lg:w-[40%] lg:max-w-xl`;
    const inputStyle = "flex-grow bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder-gray-400 text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 resize-none disabled:opacity-60";
    const sendButtonStyle = `p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150`;


    // --- Render Sidebar ---
    return (
        <div className={`${sidebarClasses} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0 bg-white fixed top-0 right-0 w-full max-w-md sm:max-w-lg lg:w-[40%] lg:max-w-xl z-10 h-16"> {/* Fixed header with explicit height */}
                 <h3 className="text-base font-semibold text-black truncate pr-2" title={projectTitle}> Project Chat </h3>
                 <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Close chat">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                 </button>
            </div>

            {/* Message Display Area - Adjusted padding-top */}
            <div className="flex-grow p-4 space-y-3 overflow-y-auto bg-gray-50/50 pt-4"> {/* Added pt-4, adjust as needed below header */}
                 {isLoading && <p className="text-center text-gray-500 text-sm py-4">Loading chat...</p>}
                 {!isLoading && error && <p className="text-center text-red-600 text-sm py-4 border border-red-100 bg-red-50 rounded-md px-2">Error: {error}</p>}
                 {!isLoading && !error && nestedCommentTree.length === 0 && ( <p className="text-center text-gray-400 text-sm py-6 italic">Be the first to send a message!</p> )}
                 {/* Render comment tree */}
                 {!isLoading && !error && renderComments(nestedCommentTree)}
                 <div ref={messagesEndRef} />
            </div>

            {/* Message Input Area (Top Level) */}
            <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                {commentsEnabled ? ( currentUser ? (
                        <form onSubmit={handlePostTopLevel} className="flex gap-2 items-end">
                             <textarea ref={textareaRef} value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} onKeyDown={handleMainKeyDown} className={inputStyle} placeholder="Type a message..." rows={1} style={{ maxHeight: '100px' }} disabled={isPosting || isLoading} required />
                             <button type="submit" className={sendButtonStyle} disabled={isPosting || isLoading || !newMessageText.trim()} title="Send message (Enter)">
                                {/* Send Icon / Spinner */}
                                {isPosting ? <svg className="animate-spin h-5 w-5 text-gray-500">...</svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="..."/></svg> }
                             </button>
                         </form> ) : ( <p className="text-center text-xs text-gray-500 py-2">Log in to chat.</p> )
                 ) : ( <p className="text-center text-xs text-gray-500 py-2 italic">Chat disabled.</p> )}
                  {/* Display relevant error message */}
                  {(postError && !replyingTo) && <p className="text-xs text-red-600 mt-1 text-center">Error: {postError}</p>}
                  {/* Reply error is now shown inline via CommentItem */}
                  {/* {(replyPostError && replyingTo) && <p className="text-xs text-red-600 mt-1 text-center">Reply Error: {replyPostError}</p>} */}
            </div>
        </div>
    );
};

export default ProjectChatSidebar;