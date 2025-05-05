// components/LearningClassroomChatSidebar.tsx
"use client";

import React, { useState, useEffect, useRef, FormEvent, KeyboardEvent, useCallback, useMemo } from 'react';
import { ClassroomComment } from '@/lib/types/learning'; // *** Import ClassroomComment type ***
import { User, getIdToken } from 'firebase/auth'; // Import auth types
import { formatTimestamp } from '@/lib/dateUtils'; // Adjust path if needed

// --- Props Interface ---
interface LearningClassroomChatSidebarProps { // *** Renamed interface ***
    classroomId: string;           // *** Changed prop name to classroomId ***
    classroomName: string;        // *** Changed prop name to classroomName ***
    currentUser: User | null;    // Current logged-in user (or null)
    commentsEnabled: boolean;    // Whether commenting is allowed for this classroom
    isOpen: boolean;              // Controls if the sidebar is visible
    onClose: () => void;          // Function to call when closing the sidebar
}

// --- Interface for nested comments structure ---
// Use ClassroomComment type
interface NestedLearningClassroomComment extends ClassroomComment { // *** Renamed interface ***
    replies: NestedLearningClassroomComment[]; // Array to hold nested replies
}

// --- Helper Function to Build Nested Structure from flat comment list ---
// Use ClassroomComment type
function buildCommentTreeLearning(comments: ClassroomComment[]): NestedLearningClassroomComment[] { // *** Renamed function ***
    const commentMap: { [id: string]: NestedLearningClassroomComment } = {};
    const nestedComments: NestedLearningClassroomComment[] = [];

    if (!comments || comments.length === 0) return [];

    // First pass: Create map entries
    comments.forEach(comment => {
        if (!comment?.id) { console.warn("Skipping comment without ID:", comment); return; };
        // Cast to the nested type
        commentMap[comment.id] = { ...comment, replies: [] } as NestedLearningClassroomComment;
    });

    // Second pass: Link replies
    Object.values(commentMap).forEach(comment => {
        if (comment.parentId && commentMap[comment.parentId]) {
            // Add to parent's replies array if not already present
            if (!commentMap[comment.parentId].replies.some(reply => reply.id === comment.id)) {
                commentMap[comment.parentId].replies.push(comment);
            }
        } else if (!comment.parentId) { // It's a top-level comment
             // Add to the root array if not already present
             if (!nestedComments.some(topLevel => topLevel.id === comment.id)) {
                nestedComments.push(comment);
            }
        }
    });

    // Sort top-level comments and their replies recursively by creation date (ascending)
    const sortByDate = (a: ClassroomComment, b: ClassroomComment) => new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime();
    const sortReplies = (commentNode: NestedLearningClassroomComment) => {
        commentNode.replies.sort(sortByDate);
        commentNode.replies.forEach(sortReplies);
    };
    nestedComments.sort(sortByDate);
    nestedComments.forEach(sortReplies);

    return nestedComments;
}


// --- Recursive Comment Item Component ---
// Renders a single comment and recursively calls itself for replies
// Use ClassroomComment and NestedLearningClassroomComment types
interface LearningClassroomCommentItemProps { // *** Renamed interface ***
    comment: NestedLearningClassroomComment; // The comment data (includes replies)
    currentUser: User | null;      // Current user for context
    classroomId: string;              // Classroom ID (for potential future actions)
    level: number;                 // Indentation level
    commentsEnabled: boolean;      // Is commenting allowed?
    // Props for handling replies for THIS specific comment item
    isPostingReply: boolean;
    replyText: string;
    onReplyTextChange: (text: string) => void;
    onReplySubmit: (e?: FormEvent | KeyboardEvent) => void; // Should handle this reply
    onReplyCancel: () => void;
    onReplyKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    isReplyingToThis: boolean; // Is the reply form for *this* comment active?
    onSetReplyTarget: (parentId: string | null) => void; // Activates reply for a comment ID
    replyError: string | null;     // Reply-specific error message
}

const LearningClassroomCommentItem: React.FC<LearningClassroomCommentItemProps> = ({ // *** Use new props interface ***
    comment, currentUser, classroomId, level, commentsEnabled,
    isPostingReply, replyText, onReplyTextChange, onReplySubmit, onReplyCancel, onReplyKeyDown,
    isReplyingToThis, onSetReplyTarget, replyError
}) => {
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null); // Ref for reply textarea

    // --- Effect for Auto-resizing Reply Textarea & Focusing ---
     useEffect(() => {
        // Focus and resize only if the reply input for this comment is active
        if (isReplyingToThis && replyTextareaRef.current) {
             const textarea = replyTextareaRef.current;
             textarea.style.height = 'auto'; // Reset height for scrollHeight calculation
             const scrollHeight = textarea.scrollHeight;
             const maxHeight = 80; // Max height in pixels before scrolling
             textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
             textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
             textarea.focus(); // Focus the textarea
        }
    }, [replyText, isReplyingToThis]); // Rerun when reply text or active state changes

    // --- Styling Variables --- (Keep consistent)
    const inputStyle = "w-full bg-gray-50 border border-gray-300 rounded-md px-2 py-1 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 resize-none disabled:opacity-60";
    const replyButtonStyle = "px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[50px]";
    const cancelButtonStyle = "px-3 py-1 bg-white text-gray-700 border border-gray-300 text-xs font-medium rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50";

    return (
        // Container for a single comment item + its potential reply form
        <div className="flex gap-2.5 items-start w-full">
             {/* Author Avatar */}
             <img
                 src={comment.postedByPhotoURL || '/default-avatar.png'} // *** Use postedByPhotoURL ***
                 alt={`${comment.postedByName || 'User'}'s avatar`} // *** Use postedByName ***
                 className="w-7 h-7 rounded-full border border-gray-200 flex-shrink-0 mt-0.5"
                 loading="lazy"
            />
             {/* Comment Bubble and Actions Container */}
             <div className="flex-grow min-w-0">
                 {/* Bubble containing comment text */}
                 <div className="bg-gray-100 border border-gray-200/80 rounded-lg rounded-tl-none px-3 py-1.5 mb-1 inline-block max-w-full">
                    {/* Header: Author, Time */}
                    <div className="flex items-baseline gap-2 mb-0.5 text-sm flex-wrap">
                        <span className="font-medium text-gray-900 whitespace-nowrap">{comment.postedByName}</span> {/* *** Use postedByName *** */}
                        <span className="text-gray-500 text-xs whitespace-nowrap" title={new Date(comment.createdAt.toString()).toLocaleString()}>
                            {formatTimestamp(comment.createdAt.toString())} {/* Relative time */}
                        </span>
                    </div>
                    {/* Text content */}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{comment.text}</p>
                 </div>
                 {/* Actions below bubble: Reply Button */}
                 {/* Show Reply button only if user is logged in AND comments are generally enabled */}
                 {currentUser && commentsEnabled && (
                     <div className="pl-1 flex items-center gap-3">
                         <button
                            // Toggle reply input for this specific comment ID
                            onClick={() => onSetReplyTarget(isReplyingToThis ? null : comment.id!)}
                            // Disable if currently posting a reply *to this comment* OR posting a top-level message
                            disabled={isPostingReply} // Removed check for isPosting, handle via state passed down
                            className="flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-blue-600 font-medium transition-colors disabled:text-gray-300 disabled:cursor-not-allowed"
                            aria-label={isReplyingToThis ? `Cancel reply to ${comment.postedByName}` : `Reply to ${comment.postedByName}`} // *** Use postedByName ***
                         >
                            {/* Reply Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.902 4.064A1.5 1.5 0 0 1 6 3.75h5.25c.414 0 .75.336.75.75v2.25a.75.75 0 0 1-1.5 0V5.25H6.31a.75.75 0 0 0-.707.443l-1 2A.75.75 0 0 0 5.25 9h3.5a.75.75 0 0 1 0 1.5h-4a2.25 2.25 0 0 1-2.096-1.33L1.402 6.33a.75.75 0 0 1 .95-.813l1.855.618A1.5 1.5 0 0 1 4.902 4.064Z" clipRule="evenodd" /></svg>
                            {isReplyingToThis ? 'Cancel' : 'Reply'}
                         </button>
                         {/* Placeholder for future Delete/Edit Comment buttons */}
                         {/* Check if currentUser.uid matches comment.postedById for edit/delete */}
                          {/* {currentUser.uid === comment.postedById && (
                              <>
                                  <button className="text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors">Edit</button>
                                  <button className="text-[11px] text-gray-500 hover:text-red-600 font-medium transition-colors">Delete</button>
                              </>
                          )} */}
                     </div>
                 )}
             </div>

             {/* --- Reply Input Form --- */}
             {/* Show only if replying to THIS comment and user is logged in */}
             {isReplyingToThis && currentUser && (
                    <div className="w-full mt-2 pl-[calc(1.75rem+0.625rem)]"> {/* Indent reply form slightly */}
                        <form onSubmit={onReplySubmit} className="flex gap-2 items-start">
                            {/* Current user avatar for reply */}
                            <img src={currentUser.photoURL || '/default-avatar.png'} alt="Your avatar" className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0 mt-1"/>
                            <div className="flex-grow flex flex-col">
                                <textarea
                                    ref={replyTextareaRef} // Attach ref for focus/sizing
                                    value={replyText}
                                    onChange={(e) => onReplyTextChange(e.target.value)}
                                    onKeyDown={onReplyKeyDown} // Handle Enter key
                                    placeholder={`Replying to ${comment.postedByName}...`} // *** Use postedByName ***
                                    rows={1} // Start as single line
                                    required
                                    autoFocus // Focus when it appears
                                    className={`${inputStyle} text-xs py-1 mb-1`} // Smaller text for reply
                                    style={{ maxHeight: '80px' }} // Limit height growth
                                    disabled={isPostingReply} // Disable while posting this reply
                                    aria-label={`Reply to ${comment.postedByName}`} // *** Use postedByName ***
                                />
                                {/* Reply Buttons & Error */}
                                <div className="flex justify-end items-center gap-2 mt-1">
                                    {/* Display reply-specific error */}
                                    {replyError && <p className='text-xs text-red-600 mr-auto'>Error: {replyError}</p>}
                                    {/* Cancel Button */}
                                    <button type="button" onClick={onReplyCancel} disabled={isPostingReply} className={cancelButtonStyle}>Cancel</button>
                                    {/* Submit Reply Button */}
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
        </div> // End comment item container
    );
};


// --- Main Learning Classroom Chat Sidebar Component ---
const LearningClassroomChatSidebar: React.FC<LearningClassroomChatSidebarProps> = ({ // *** Use new props interface ***
    classroomId,
    classroomName, // *** Use classroomName ***
    currentUser,
    commentsEnabled,
    isOpen,
    onClose
}) => {
    // --- State ---
    const [allComments, setAllComments] = useState<ClassroomComment[]>([]); // Holds the flat list from API
    const [isLoading, setIsLoading] = useState(false); // Loading state for initial comment fetch
    const [error, setError] = useState<string | null>(null); // Error state for initial comment fetch
    const [newMessageText, setNewMessageText] = useState(''); // State for the main chat input
    const [isPosting, setIsPosting] = useState(false); // Loading state for posting top-level message
    const [postError, setPostError] = useState<string | null>(null); // Error state for posting top-level message
    const [replyingTo, setReplyingTo] = useState<string | null>(null); // ID of the comment being replied to, or null
    const [replyText, setReplyText] = useState(''); // Text state for the active reply input
    const [isPostingReply, setIsPostingReply] = useState(false); // Loading state for posting a reply
    const [replyPostError, setReplyPostError] = useState<string | null>(null); // Error state for posting a reply

    // Refs for scrolling and main textarea
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // --- Fetch ALL Comments when sidebar opens or classroomId changes ---
    useEffect(() => {
        // Only fetch when sidebar is open and we have a valid classroomId AND a logged-in user (due to security rules)
        // If not logged in, the API will return 401/403, handled below.
        if (!isOpen || !classroomId || !currentUser) {
            setAllComments([]); // Clear comments if closed or no ID/user
            if (!isOpen) console.log("Chat Sidebar: Closed, clearing comments.");
            else if (!classroomId) console.warn("Chat Sidebar: classroomId missing, cannot fetch.");
            else if (!currentUser) console.log("Chat Sidebar: User not logged in, cannot fetch comments.");
            setIsLoading(false); // Ensure loading is off if not fetching
             setError(null); // Clear previous errors
            return;
        }

        console.log(`Fetching comments for classroom ${classroomId}...`);
        setIsLoading(true); // Start loading
        setError(null); // Clear errors
        // setAllComments([]); // Don't clear immediately if sidebar is just toggling open? Policy decision.
                           // Let's clear to show loading state clearly.
        setAllComments([]);

        const fetchComments = async () => {
            try {
                const idToken = await getIdToken(currentUser, true); // Get token for auth
                // *** CHANGE API ENDPOINT to use classroomId ***
                const response = await fetch(`/api/learning-classrooms/${classroomId}/comments`, {
                     headers: { 'Authorization': `Bearer ${idToken}` },
                });

                // Check if component unmounted during fetch
                // Note: Need a separate isMounted flag or AbortController for true safety in real apps
                // For this example, we rely on React's effect cleanup reducing risk.

                if (!response.ok) {
                    const errData = await response.json().catch(()=>{ return { error: `API Error ${response.status}` } });
                     // Handle specific auth/permission errors
                     if (response.status === 401 || response.status === 403) {
                         setError("You do not have permission to view comments.");
                     } else {
                         setError(errData.error || `Failed to fetch comments (${response.status})`);
                     }
                    console.error("Error fetching learning classroom comments:", response.status, errData);
                    setAllComments([]); // Ensure state is empty on error
                    return; // Stop execution
                }
                const data = await response.json(); // Expecting { comments: [...] }

                if (data.comments && Array.isArray(data.comments)) {
                    // Sort comments by creation date (ascending) for chat flow
                    const sorted = data.comments.sort((a: ClassroomComment, b: ClassroomComment) =>
                        new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime()
                    );
                    console.log(`Fetched ${sorted.length} comments.`);
                    setAllComments(sorted); // Update state with the fresh, sorted list
                } else {
                    console.warn("Invalid comments data format received for classroom chat.");
                    setAllComments([]); // Set empty array if format is wrong
                }
            } catch (err: any) {
                console.error("Error fetching learning classroom comments:", err);
                setError(err.message || "Could not load comments.");
                setAllComments([]); // Ensure state is empty on error
            } finally {
                setIsLoading(false); // Stop loading indicator
                console.log("Chat Sidebar: Comments fetch complete.");
            }
        };
        fetchComments(); // Execute fetch

        // Cleanup is implicitly handled by React's effect mechanism re-running
        // or component unmounting.
    }, [isOpen, classroomId, currentUser]); // Dependencies: Run effect when isOpen, classroomId, or currentUser changes

    // --- Build Nested Comment Tree ---
    // useMemo recalculates the tree only when the flat list of comments changes
    const nestedCommentTree = useMemo(() => buildCommentTreeLearning(allComments), [allComments]); // *** Use Learning version of buildCommentTree ***

    // --- Scroll to Bottom Effect ---
    useEffect(() => {
        // Scroll smoothly to the end after comments are loaded/updated AND sidebar is open
        if (isOpen && !isLoading && messagesEndRef.current) {
            // Use a slight delay to allow the DOM to update fully
            const timer = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 100); // Slightly shorter delay
            return () => clearTimeout(timer); // Clear timeout on cleanup
        }
         // Dependencies: Re-run effect when nestedCommentTree changes or sidebar opens/loading status changes
    }, [nestedCommentTree, isOpen, isLoading]);

    // --- Main Textarea Resize Effect ---
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 100; // Max height in pixels before scrolling
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [newMessageText]); // Rerun when text changes

     // --- Refetch Comments Function ---
     // useCallback ensures this function reference doesn't change unnecessarily
     const refetchComments = useCallback(async () => {
        // Need classroomId and currentUser to refetch
        if (!classroomId || !currentUser) {
             console.warn("Refetch skipped: missing classroomId or currentUser.");
             setError("Cannot refresh comments (Not logged in or Classroom ID missing)."); // Show an error if cannot refetch
             return;
        }
        console.log(`Refetching learning classroom comments for ${classroomId}...`);
        setError(null); // Clear previous fetch errors
        // Keep existing comments visible while refetching? Or show spinner?
        // For simplicity, let's show spinner while refetching.
        setIsLoading(true);
        try {
            const idToken = await getIdToken(currentUser, true); // Get fresh token
            // *** Fetch from the correct classroom-specific comments endpoint ***
            const response = await fetch(`/api/learning-classrooms/${classroomId}/comments`, {
                 headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!response.ok) { throw new Error(`Refetch failed (${response.status})`); }
            const data = await response.json(); // Expect { comments: [...] }
            if (data.comments && Array.isArray(data.comments)) {
                // Sort again after refetching
                 const sorted = data.comments.sort((a: ClassroomComment, b: ClassroomComment) =>
                    new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime()
                 );
                setAllComments(sorted); // Update state with the fresh, sorted list
                console.log(`Refetch successful: ${sorted.length} comments.`);
            } else {
                 console.warn("Refetch received unexpected data format.");
                 setAllComments([]); // Set empty array if format is wrong
            }
            setPostError(null); // Clear specific posting errors on successful refetch
            setReplyPostError(null); // Clear specific reply errors
        } catch (err: any) {
            console.error("Refetch comments error:", err);
            setError(err.message || "Failed to refresh comments."); // Show general error if refetch fails
        } finally {
            setIsLoading(false); // Hide loading spinner
        }
    }, [classroomId, currentUser]); // Dependencies: classroomId and currentUser are needed for refetch

    // --- Generic Post Message Function (Handles both top-level and replies) ---
    // Uses refetchComments on success instead of optimistic updates for simplicity
    const handlePostMessage = useCallback(async (
        text: string,
        parentId: string | null, // Null for top-level, string ID for reply
        onSuccess: () => void, // Function to run on successful post (e.g., clear input)
        setIsPostingState: React.Dispatch<React.SetStateAction<boolean>>, // State setter for loading indicator
        setErrorState: React.Dispatch<React.SetStateAction<string | null>> // State setter for error message
    ) => {
        // Basic validation and checks
        // Need currentUser to post, comments must be enabled, text cannot be empty
        if (!currentUser || !commentsEnabled || !text.trim()) {
            if (!currentUser) setErrorState("You must be logged in to post.");
            else if (!commentsEnabled) setErrorState("Comments are disabled for this classroom.");
            else setErrorState("Message cannot be empty.");
            return;
        }
        if (!classroomId) { // Should not happen if called from detail page, but safety check
             setErrorState("Classroom ID is missing.");
             return;
        }

        setIsPostingState(true); // Show loading state for this specific action
        setErrorState(null); // Clear previous errors for this action

        // Optimistically clear the relevant input field *before* the API call
        // This makes the UI feel faster.
        onSuccess();

        try {
            const idToken = await getIdToken(currentUser, true); // Get fresh token
            // *** Post to the correct classroom-specific comments endpoint ***
            const response = await fetch(`/api/learning-classrooms/${classroomId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({
                     classroomId: classroomId, // Include classroomId in payload (redundant with path, but safe)
                     text: text.trim(),
                     parentId: parentId, // Null for top-level, string ID for reply
                     // Backend will add authorId, authorName, authorPhotoURL, createdAt
                 })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({})); // Try to parse error
                 // Handle specific errors (e.g., comments disabled - though handled by frontend already, API check is backend safety)
                throw new Error(errData.message || `Post failed (${response.status})`);
            }

            // Instead of optimistic update, refetch the full list for simplicity and consistency
            console.log("Learning Classroom comment post successful, refetching comments...");
            await refetchComments(); // Call the refetch function


        } catch (err: any) {
            console.error("Error posting learning classroom comment:", err)
            setErrorState(err.message || "Could not send message.");
            // If optimistic update was used, would need rollback logic here
        } finally {
            setIsPostingState(false); // Hide loading state for this specific action
             // Clear top-level error state after any post attempt, successful or not
             // Reply errors are cleared by their input handler
             if (parentId === null) setPostError(null);
        }
    }, [currentUser, commentsEnabled, classroomId, refetchComments]); // Dependencies: Need these values to make the call or refetch

    // --- Specific Event Handlers using the generic post function ---
    // Handle submitting the main chat input
    const handlePostTopLevel = (e?: FormEvent | KeyboardEvent) => {
        e?.preventDefault(); // Prevent default form submission if called from a form
        // Use the generic handler with null parentId
        handlePostMessage(
            newMessageText,
            null, // parentId is null for top-level
            () => setNewMessageText(''), // Success callback: clear main input
            setIsPosting, // State setter for main posting loading
            setPostError // State setter for main posting error
        );
    };

    // Handle submitting a reply input
    const handlePostReply = (e?: FormEvent | KeyboardEvent) => {
         e?.preventDefault(); // Prevent default form submission
         // Use the generic handler with the stored replyingTo ID
         if (replyingTo) { // Ensure we have a target to reply to
             handlePostMessage(
                 replyText,
                 replyingTo, // parentId is the comment ID being replied to
                 () => { setReplyText(''); setReplyingTo(null); }, // Success callback: clear reply input and target
                 setIsPostingReply, // State setter for reply posting loading
                 setReplyPostError // State setter for reply posting error
             );
         }
     };

    // Handle Enter key press for submitting messages (without Shift/Ctrl)
    // In main input, if Enter is pressed and not Shift/Ctrl, trigger top-level post
    const handleMainKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && newMessageText.trim()) {
            e.preventDefault(); // Prevent default newline
            handlePostTopLevel(); // Trigger the post handler
        }
    };
    // In reply input, if Enter is pressed and not Shift/Ctrl, trigger reply post
    const handleReplyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
         if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && replyText.trim()) {
             e.preventDefault(); // Prevent default newline
             handlePostReply(); // Trigger the reply post handler
         }
     };

    // Set the target comment ID for replying, clear reply text/error
    // If setting to null, it cancels the current reply
    const handleSetReplyTarget = (commentId: string | null) => {
        setReplyingTo(commentId);
        setReplyText(''); // Clear the reply input text
        setReplyPostError(null); // Clear any reply errors
        // Also clear the main post error when starting a reply? Policy decision.
        // setPostError(null);
    };

    // Cancel the current reply action
    const handleCancelReply = () => {
        setReplyingTo(null); // Clear the target
        setReplyText(''); // Clear the reply input text
        setReplyPostError(null); // Clear any reply errors
    };


    // --- Recursive Renderer Function ---
    // useCallback ensures this function reference is stable unless dependencies change
    // Uses LearningClassroomCommentItem component
    const renderComments = useCallback((commentsToRender: NestedLearningClassroomComment[], level = 0): JSX.Element[] => { // *** Use Learning version of NestedComment ***
        const maxIndentLevel = 5; // Define max visual indentation levels
        const currentIndentLevel = Math.min(level, maxIndentLevel);

        return commentsToRender.map(comment => (
            <div key={comment.id} className={`w-full ${level > 0 ? `pl-3 border-l-2 border-gray-200/70 ml-3` : ''}`}> {/* Added consistent ml-3 */}
                {/* Render the individual comment item */}
                <LearningClassroomCommentItem // *** Use Learning version of CommentItem ***
                    comment={comment} // Pass LearningComment down
                    currentUser={currentUser}
                    classroomId={classroomId!} // Pass classroomId (asserting non-null)
                    level={level}
                    commentsEnabled={commentsEnabled} // Pass comments enabled status

                    // Pass reply state and handlers down, ensuring they target the MAIN sidebar state
                    isPostingReply={isPostingReply} // Pass global reply loading state
                    replyText={replyText} // Pass global reply input text
                    onReplyTextChange={setReplyText} // Pass global reply input handler
                    onReplySubmit={handlePostReply} // Pass the global reply submit handler
                    onReplyCancel={handleCancelReply} // Pass the global reply cancel handler
                    onReplyKeyDown={handleReplyKeyDown} // Pass the global reply key handler
                    isReplyingToThis={replyingTo === comment.id} // Check if the global target is THIS comment ID
                    onSetReplyTarget={handleSetReplyTarget} // Pass the global handler to set reply target
                    replyError={replyingTo === comment.id ? replyPostError : null} // Pass error only if replying to this one
                />
                {/* Recursively render replies if they exist */}
                {/* Use optional chaining and check for array type */}
                {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-3"> {/* Add spacing before nested replies */}
                        {renderComments(comment.replies, level + 1)} {/* Recursively call */}
                    </div>
                )}
            </div>
        ));
    }, [currentUser, classroomId, commentsEnabled, replyingTo, isPostingReply, replyText, handlePostReply, handleCancelReply, handleReplyKeyDown, handleSetReplyTarget, replyPostError]); // Dependencies


    // --- Styling Variables --- (Keep consistent)
    // Adjusted positioning: fixed top-16 (assuming 4rem/64px navbar), calculated height
    // Adjusted max-width for consistency
    const sidebarClasses = `fixed top-16 right-0 h-[calc(100vh-4rem)] bg-white border-l border-gray-200 shadow-xl z-40 transition-transform duration-300 ease-in-out flex flex-col w-full max-w-sm sm:max-w-md md:max-w-lg`; // Adjusted max width slightly for sidebar


    // --- Render Sidebar ---
    return (
        // Apply translation based on isOpen state for slide-in/out effect
        // Use absolute positioning relative to its containing block (the detail page flex container)
        // if you want a push layout, OR fixed if it should float over content.
        // Let's keep the fixed/floating pattern like PlacementChatSidebar
        <div className={`${sidebarClasses} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

            {/* Sidebar Header */}
            {/* Stays fixed at the top of the sidebar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white h-16">
                 <h3 className="text-base font-semibold text-gray-900 truncate pr-2" title={classroomName}> {classroomName || 'Classroom'} Q&A </h3> {/* *** Use classroomName *** */}
                 {/* Close Button */}
                 <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:text-red-600 hover:bg-red-100 transition-colors" title="Close chat">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                 </button>
            </div>

            {/* Message Display Area */}
            {/* flex-grow makes this take available vertical space */}
            {/* overflow-y-auto enables scrolling ONLY for this section */}
            {/* pb-4 ensures last message isn't hidden by input area */}
            <div className="flex-grow p-4 space-y-3 overflow-y-auto bg-gray-50/50 pb-4">
                 {/* Loading State for comments fetch */}
                 {isLoading ? <p className="text-center text-gray-500 text-sm py-4">Loading Q&A...</p> : null}
                 {/* Error State for comments fetch */}
                 {!isLoading && error ? <p className="text-center text-red-600 text-sm py-4 border border-red-100 bg-red-50 rounded-md px-2">Error: {error}</p> : null}
                 {/* Empty State */}
                 {!isLoading && !error && nestedCommentTree.length === 0 ? (
                      commentsEnabled ? ( // Different message if comments are enabled but empty
                         <p className="text-center text-gray-400 text-sm py-6 italic">No questions or comments yet. Be the first to ask!</p>
                      ) : ( // Message if comments are disabled
                         <p className="text-center text-gray-400 text-sm py-6 italic">Q&A is disabled for this classroom.</p>
                      )
                 ) : null}
                 {/* Render comment tree if not loading and no error */}
                 {!isLoading && !error && renderComments(nestedCommentTree)}
                 {/* Empty div at the end acts as anchor for smooth scrolling */}
                 <div ref={messagesEndRef} />
            </div>

            {/* Message Input Area (Bottom) */}
            {/* flex-shrink-0 prevents this area from shrinking */}
            <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                 {/* Conditional rendering based on commentsEnabled and currentUser */}
                 {/* Show input form only if comments are enabled AND user is logged in */}
                 {(commentsEnabled && currentUser) ? (
                        // Logged-in and comments enabled: Show input form
                        <form onSubmit={handlePostTopLevel} className="flex gap-2 items-end">
                             <textarea
                                 ref={textareaRef} // Ref for auto-resizing
                                 value={newMessageText}
                                 onChange={(e) => setNewMessageText(e.target.value)}
                                 onKeyDown={handleMainKeyDown} // Handle Enter key for submit
                                 className={inputStyle}
                                 placeholder="Ask a question or post a comment..."
                                 rows={1} // Start as single line
                                 style={{ maxHeight: '100px' }} // Limit height growth
                                 disabled={isPosting || isLoading} // Disable during posting or initial comments loading
                                 required // Basic HTML5 validation (for non-empty text)
                                 aria-label="New comment message"
                             />
                             <button
                                type="submit"
                                className={sendButtonStyle}
                                disabled={isPosting || isLoading || !newMessageText.trim()} // Disable if posting, loading comments, or text is empty
                                title="Post Message (Enter)"
                                aria-label="Post message"
                             >
                                {/* Send Icon or Loading Spinner */}
                                {isPosting ?
                                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M2.87 2.298a.75.75 0 0 0-.812 1.03l3.596 7.233-3.596 7.233a.75.75 0 0 0 .812 1.03l11.25-4.5a.75.75 0 0 0 0-1.062l-11.25-4.5Z" /></svg> }
                             </button>
                         </form>
                     ) : (
                        // Not logged-in OR comments disabled: Show appropriate message
                         (!currentUser) ? (
                              <p className="text-center text-xs text-gray-500 py-2">Please log in to post questions or comments.</p>
                         ) : ( // commentsEnabled is false
                              <p className="text-center text-xs text-gray-500 py-2 italic">Q&A is disabled for this classroom.</p>
                         )
                    )
                 }
                  {/* Display top-level posting error if not currently replying */}
                  {/* Show error message only if it's not a reply error */}
                  {(postError && !replyingTo) && <p className="text-xs text-red-600 mt-1 text-center">Error: {postError}</p>}
                  {/* Reply-specific errors are shown inline within the LearningClassroomCommentItem */}
            </div>
        </div>
    );
};

export default LearningClassroomChatSidebar; // *** Export new component name ***