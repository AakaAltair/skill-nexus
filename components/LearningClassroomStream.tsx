// components/LearningClassroomStream.tsx
"use client";

import React, { useState, FormEvent, useEffect, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
// *** Use ClassroomStreamItem and Attachment types from learning types ***
import { ClassroomStreamItem, Attachment } from '@/lib/types/learning';
import { User, getIdToken } from 'firebase/auth'; // Import auth types
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTimestamp } from '@/lib/dateUtils'; // Adjust path if needed
import linkifyIt from 'linkify-it'; // For auto-detecting links in content

const linkify = linkifyIt(); // Initialize linkifier

interface LearningClassroomStreamProps { // *** Renamed interface ***
    classroomId: string; // *** Changed prop name to classroomId ***
    isTeacher: boolean; // *** Changed prop name from isOwner to isTeacher ***
    // Note: We won't pass initialUpdates here. The component will fetch its own.
    currentUser: User | null;
}

// Interface for temporary file info held in state (Keep identical for simulation)
interface TempFile {
    file: File;
    id: string;
    previewUrl?: string; // Data URL for image previews
}

const LearningClassroomStream: React.FC<LearningClassroomStreamProps> = ({
    classroomId, isTeacher, currentUser // *** Use classroomId and isTeacher ***
}) => {
    // --- State ---
    const [updates, setUpdates] = useState<ClassroomStreamItem[]>([]); // *** Use ClassroomStreamItem type ***
    const [isLoading, setIsLoading] = useState(true); // Loading state for initial fetch
    const [error, setError] = useState<string | null>(null); // Error state for initial fetch
    const [newUpdateContent, setNewUpdateContent] = useState(''); // State for the new post textarea
    const [isPostingUpdate, setIsPostingUpdate] = useState(false); // Loading state for posting
    const [postUpdateError, setPostUpdateError] = useState<string | null>(null); // Error state for posting
    const [tempFiles, setTempFiles] = useState<TempFile[]>([]); // State for simulating file attachments
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input
    const [isDragging, setIsDragging] = useState(false); // State for drag-and-drop visual feedback

     // --- Fetch Stream Items when classroomId or currentUser changes ---
    useEffect(() => {
        // Need classroomId and a logged-in user to fetch stream items
        if (!classroomId || !currentUser) {
             // If no classroomId or user, stop loading if it was active, clear data/errors
             if (!classroomId) {
                 setError("Classroom ID is missing.");
             } else if (!currentUser) {
                 // Error already handled by parent page redirect/message
             }
             setIsLoading(false);
             setUpdates([]);
             return; // Exit effect
        }

        console.log(`Fetching stream items for classroom ${classroomId}...`);
        setIsLoading(true); // Start loading state for fetch
        setError(null); // Clear previous errors
        setUpdates([]); // Clear previous updates while loading new ones

        const fetchStreamItems = async () => {
            try {
                const idToken = await getIdToken(currentUser, true);
                // *** CHANGE API ENDPOINT to use classroomId and /streamItems ***
                const response = await fetch(`/api/learning-classrooms/${classroomId}/streamItems`, {
                     headers: { 'Authorization': `Bearer ${idToken}` },
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                     // Handle 403 Forbidden specifically if the user is not a member (though parent should catch this)
                    if (response.status === 403) {
                         setError("You do not have permission to view this stream.");
                     } else {
                        setError(errData.message || `Failed to fetch stream (${response.status})`);
                    }
                    console.error(`❌ Fetch stream items error: ${response.status}`, errData);
                    setUpdates([]); // Ensure state is empty on error
                    return; // Stop execution
                }

                const data = await response.json(); // Expecting { streamItems: [...] }

                if (data.streamItems && Array.isArray(data.streamItems)) {
                     // Sort stream items by creation date (descending) for chronological feed
                    const sortedUpdates = data.streamItems.sort((a: ClassroomStreamItem, b: ClassroomStreamItem) =>
                         new Date(b.createdAt.toString()).getTime() - new Date(a.createdAt.toString()).getTime()
                    );
                    console.log(`Fetched ${sortedUpdates.length} stream items.`);
                    setUpdates(sortedUpdates); // Set the fetched and sorted updates
                } else {
                    console.warn("Received unexpected data format for stream items:", data);
                    setUpdates([]); // Fallback to empty array
                }

            } catch (err: any) {
                console.error("❌ Error fetching learning classroom stream:", err);
                setError(err.message || "Could not load stream content.");
                setUpdates([]); // Ensure state is empty on error
            } finally {
                setIsLoading(false); // Stop loading state
            }
        };

        fetchStreamItems();

         // No cleanup needed for simple fetch, but useful for real-time listeners
        // return () => { /* cleanup logic for listeners */ };

    }, [classroomId, currentUser]); // Dependencies: Re-run if classroomId or currentUser changes

    // --- File Processing Logic --- (Keep identical for now, just simulates)
    const processFiles = useCallback((files: FileList | null | undefined) => {
        if (!files || files.length === 0 || !currentUser) return;
        const filesToProcess = Array.from(files);
        let currentError: string | null = null;
        const currentAttachmentCount = tempFiles.length;
        const maxFiles = 5; // Define max files limit

        if (currentAttachmentCount + filesToProcess.length > maxFiles) {
            currentError = `Max ${maxFiles} file attachments allowed.`;
            // Optionally truncate filesToProcess here if you want to allow adding up to the limit
            // filesToProcess = filesToProcess.slice(0, maxFiles - currentAttachmentCount);
             setPostUpdateError(currentError); // Show error
             return; // Stop processing
        }

        const newTempFilesState: TempFile[] = [];
        const previewPromises: Promise<void>[] = [];

        filesToProcess.forEach(file => {
             const maxSizeMB = 10; // Define max file size limit in MB
            if (file.size > maxSizeMB * 1024 * 1024) {
                currentError = `File "${file.name}" ignored (exceeds ${maxSizeMB}MB).`;
                return; // Skip this file
            }

            const newFileId = crypto.randomUUID(); // Generate a unique ID for the temporary file
            const newTempFile: TempFile = { file: file, id: newFileId };
            newTempFilesState.push(newTempFile);

            // Create preview URL for images
            if (file.type.startsWith("image/")) {
                 previewPromises.push(new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        // Find the temp file by ID and add the preview URL
                        const index = newTempFilesState.findIndex(tf => tf.id === newFileId);
                        if(index !== -1 && typeof reader.result === 'string') {
                             newTempFilesState[index].previewUrl = reader.result;
                        }
                        resolve();
                    };
                    reader.onerror = () => resolve(); // Resolve even on error
                    reader.readAsDataURL(file);
                }));
            }
        });

        // Update state with new temporary files (with or without previews)
        setTempFiles(prev => [...prev, ...newTempFilesState.filter(tf => !prev.some(p => p.id === tf.id))]); // Add only unique new files
        if(currentError) setPostUpdateError(currentError); // Show first error encountered

        // Wait for all previews to process, then update state *again* in case previews were async
        if (previewPromises.length > 0) {
            Promise.all(previewPromises).then(() => {
                setTempFiles(currentFiles => currentFiles.map(tf => {
                    const updatedFile = newTempFilesState.find(ntf => ntf.id === tf.id && ntf.previewUrl);
                    return updatedFile ? { ...tf, previewUrl: updatedFile.previewUrl } : tf; // Only update if preview was added
                 }));
                 console.log("Finished processing file previews.");
            });
        }
    }, [currentUser, tempFiles.length]); // Dependencies for useCallback

    // --- Event Handlers --- (Keep identical where logic is the same)
    // Trigger hidden file input click
    const triggerFileSelect = useCallback(() => { fileInputRef.current?.click(); }, []);
    // Handle file selection from the input
    const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        processFiles(event.target.files);
        // Clear the file input value so the same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, [processFiles]); // Dependency on processFiles
    // Remove a temporary file from the draft state
    const handleRemoveTempFile = useCallback((fileIdToRemove: string) => {
        setTempFiles(prev => prev.filter(tf => tf.id !== fileIdToRemove));
         // Clear error if it was related to max files and we're now below the limit
        if (postUpdateError && tempFiles.length <= 5) { setPostUpdateError(null); }
    }, [tempFiles.length, postUpdateError]); // Dependencies
    // Drag-and-drop handlers
    const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); }, []);
    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); processFiles(e.dataTransfer.files); }, [processFiles]);


    // --- Handle Posting New Update ---
    const handlePostUpdate = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const contentToPost = newUpdateContent.trim();
        // Require content or files to post
        // Only allow posting if user is a teacher in this classroom
        if (!isTeacher || !currentUser || (!contentToPost && tempFiles.length === 0)) {
            if (!isTeacher) setPostUpdateError("Only teachers can post updates.");
            else if (!currentUser) setPostUpdateError("You must be logged in to post.");
            else if (!contentToPost && tempFiles.length === 0) setPostUpdateError("Please enter content or attach a file.");
            return;
        }

        setIsPostingUpdate(true); // Start posting loading state
        setPostUpdateError(null); // Clear previous posting errors

        // Simulate attachments (same structure as before, storing metadata)
        const detectedLinks = linkify.match(contentToPost) || [];
        const linkAttachments: Attachment[] = detectedLinks.map(match => ({ name: match.text, url: match.url, type: 'link' }));
        const fileAttachments: Attachment[] = tempFiles.map(tf => ({
             name: tf.file.name,
             url: `local:${tf.file.name}`, // Temporary placeholder URL
             type: tf.file.type.startsWith('image/') ? 'image' : (tf.file.type.includes('pdf') ? 'pdf' : 'file'), // Basic type detection
             fileMetadata: { size: tf.file.size, fileType: tf.file.type }, // Store metadata
        }));
        const allAttachments: Attachment[] = [...linkAttachments, ...fileAttachments];

        try {
            const idToken = await getIdToken(currentUser, true);
            const payload = {
                classroomId: classroomId, // Include classroomId in the payload
                content: contentToPost,
                attachments: allAttachments, // Send simulated attachments with metadata
                // Backend will add authorId, authorName, authorPhotoURL, createdAt, type (default 'announcement')
            };
            console.log("Posting Learning Classroom Update Payload:", payload);

            // *** Use the correct API ENDPOINT for classroom stream items ***
            const response = await fetch(`/api/learning-classrooms/${classroomId}/streamItems`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `API Error ${response.status}`);
            }
            const result = await response.json(); // Expect { message: ..., streamItemId: ... }

            // *** TODO: Actual file upload logic to Firebase Storage would go here eventually ***
            // After successful Firestore document creation, loop through tempFiles
            // and upload them to Storage, then update the stream item document
            // with the actual download URLs, replacing the temporary metadata.
            console.log("Simulating file upload for learning classroom update:", tempFiles.map(f => f.file.name));


            // Optimistic Update: Add the new update to the state immediately
            // Create an optimistic object based on the payload and current user info
            const optimisticUpdate: ClassroomStreamItem = {
                id: result.streamItemId || crypto.randomUUID(), // Use returned ID or client-gen ID
                classroomId: classroomId,
                authorId: currentUser.uid,
                authorName: currentUser.displayName || 'You', // Use current user's display name
                authorPhotoURL: currentUser.photoURL || '/default-avatar.png', // Use current user's photo
                content: contentToPost,
                attachments: allAttachments, // Use the attachments sent
                createdAt: new Date().toISOString(), // Use client time for optimistic display
                type: 'announcement', // Default type set by backend or client
            };
            // Add the new update to the top of the list (newest first)
            setUpdates(prevUpdates => [optimisticUpdate, ...prevUpdates]);

            // Reset form state
            setNewUpdateContent('');
            setTempFiles([]);
            setPostUpdateError(null); // Clear posting error


        } catch (err: any) {
            console.error("❌ Post learning classroom update error:", err);
            // Display the error message received or a default one
            setPostUpdateError(err.message || "Could not post update.");
            // Note: With optimistic updates, you might need rollback logic here
            // if the API call failed *after* adding optimistically.
        } finally {
            setIsPostingUpdate(false); // Stop posting loading state
        }
     };

    // --- Styling Variables --- (Keep consistent with Resource Stream)
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 text-black outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition duration-150 disabled:opacity-60";
    const postButtonStyle = "px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center";
    const cancelButtonStyle = "px-4 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 disabled:opacity-50";
    const removeButtonStyle = "text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-100 flex-shrink-0 transition-colors disabled:opacity-50";
    const isUploading = isPostingUpdate; // Alias

    // --- Render ---
    return (
        <div className="space-y-6">
             {/* Post Update Form (Teacher Only) */}
             {/* Show form only if auth is loaded, user exists, and user is a teacher in this classroom */}
             {(!isAuthLoading && !isProfileLoading && currentUser && isTeacher) && (
                 <form onSubmit={handlePostUpdate} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm mb-6 space-y-4">
                    {/* Avatar + Textarea */}
                    <div className="flex items-start gap-3">
                         <img src={currentUser.photoURL || '/default-avatar.png'} alt="Your avatar" className="w-8 h-8 rounded-full border flex-shrink-0 mt-1"/>
                         <textarea
                             id={`classroomUpdate-${classroomId}`} // Unique ID per classroom
                             value={newUpdateContent}
                             onChange={(e) => setNewUpdateContent(e.target.value)}
                             className={`${inputStyle} min-h-[80px]`}
                             // *** Update placeholder text ***
                             placeholder="Announce something to your students..."
                             rows={3}
                             disabled={isPostingUpdate} // Disable while posting
                             required={tempFiles.length === 0 && newUpdateContent.trim().length === 0} // Required only if no content or files attached
                         />
                    </div>

                     {/* Attachment Area (Keep identical JSX structure) */}
                     <div className="pl-11 space-y-3">
                         {/* Drop Zone */}
                         <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors duration-200 ${isDragging ? 'border-blue-500 bg-blue-50/80' : 'border-gray-300 hover:border-gray-400 bg-white'}`}>
                             <label htmlFor={`file-upload-classroom-${classroomId}`} className={`cursor-pointer w-full flex flex-col items-center text-gray-500 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                                <span className={`text-sm font-medium ${isDragging ? 'text-blue-700' : 'text-gray-600'}`}> Drag & drop files or <span className="text-blue-600 font-semibold">browse</span> </span>
                                {/* Updated file types info */}
                                <span className="text-xs text-gray-400 mt-1">Images, PDFs, Docs, etc. (Max {maxFiles} files, {maxSizeMB}MB each)</span>
                            </label>
                             <input id={`file-upload-classroom-${classroomId}`} name="file-upload-classroom" type="file" className="sr-only" ref={fileInputRef} onChange={handleFileChange} multiple disabled={isUploading || isPostingUpdate} accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx" /> {/* Update accept types */}
                         </div>
                         {/* Display Draft Temp Files (Identical JSX structure, uses simulated data) */}
                         {tempFiles.length > 0 && ( <div className="space-y-2 pt-3 border-t border-gray-100"> <p className="text-xs font-medium text-gray-600">Files to attach:</p><ul className="list-none pl-0 space-y-2">{tempFiles.map((tf) => ( <li key={tf.id} className="flex justify-between items-center text-sm bg-gray-50/80 p-1.5 pl-2.5 rounded border border-gray-200/80"> <div className="flex items-center gap-2 min-w-0">{tf.previewUrl ? ( <img src={tf.previewUrl} alt="Preview" className="w-7 h-7 object-cover rounded flex-shrink-0 bg-gray-200 border"/>) : ( <span className="flex-shrink-0 w-6 h-6 text-gray-500 text-xl leading-none">{/* Add file type icons here if desired */}📄</span>)} <span className="truncate" title={tf.file.name}>{tf.file.name}</span> <span className="text-gray-400 text-[10px] flex-shrink-0">({ (tf.file.size / 1024).toFixed(1) } KB)</span></div><button type="button" onClick={() => handleRemoveTempFile(tf.id)} className={removeButtonStyle} title="Remove" disabled={isPostingUpdate || isUploading}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button> </li> ))}</ul> </div> )}
                         {/* General Update Error Display */}
                         {postUpdateError && <p className="text-xs text-red-600 mt-1">{postUpdateError}</p>}
                     </div>
                     {/* Post Update Button Area (Identical JSX Structure) */}
                     <div className="flex justify-end items-center gap-3 pt-3 border-t border-gray-100">
                         <button type="button" onClick={() => { setNewUpdateContent(''); setTempFiles([]); setPostUpdateError(null); }} disabled={isPostingUpdate} className={cancelButtonStyle}>Cancel</button>
                         <button type="submit" className={postButtonStyle} disabled={isPostingUpdate || isUploading || (!newUpdateContent.trim() && tempFiles.length === 0)}>
                             {isPostingUpdate ? (<svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V..." className="opacity-75" fill="currentColor"></path></svg>) : null}
                             {isPostingUpdate ? 'Posting...' : 'Post Update'}
                         </button>
                     </div>
                 </form>
             )}
             {/* If not a teacher, maybe show a disabled form or just the feed */}
             {(!isAuthLoading && !isProfileLoading && currentUser && !isTeacher) && (
                 <div className="bg-gray-100 p-4 border border-gray-200 rounded-lg shadow-sm mb-6 text-center text-gray-600 text-sm">
                      Only teachers can post announcements.
                 </div>
             )}


             {/* --- Updates Feed --- */}
             <div className="space-y-5">
                 <h3 className="text-xl font-semibold text-gray-800 px-1 mb-3">Stream</h3> {/* Updated Heading */}
                 {isLoading ? (
                     <div className="flex justify-center py-8"><LoadingSpinner /></div>
                 ) : error ? (
                     <div className="py-8"><ErrorMessage message={error} /></div>
                 ) : updates.length === 0 ? (
                    // Update empty state message
                    <div className="bg-white p-4 border border-dashed border-gray-200 rounded-lg text-center text-gray-500 text-sm">
                        No announcements or updates have been posted yet.
                    </div>
                ) : (
                     // Map over ClassroomStreamItem[] state
                     updates.map(update => (
                         <div key={update.id} className="bg-white p-5 border border-gray-200/80 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-150">
                             {/* Update Header */}
                             <div className="flex items-center gap-2.5 mb-3 text-sm">
                                 <img src={update.authorPhotoURL || '/default-avatar.png'} alt={update.authorName} className="w-9 h-9 rounded-full border flex-shrink-0"/>
                                 <div><span className="font-semibold text-black block truncate">{update.authorName}</span><span className="text-gray-500 text-xs" title={new Date(update.createdAt.toString()).toLocaleString()}> {formatTimestamp(update.createdAt)} </span></div>
                             </div>
                             {/* Update Content (Markdown) */}
                             {/* Only render markdown if content is not empty */}
                             {update.content.trim().length > 0 && (
                                 <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline mb-4 last:mb-0"> {/* Added margin-bottom */}
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
                                 </article>
                             )}

                             {/* Display Attachments (Links or Temporary File Placeholders) */}
                             {update.attachments && update.attachments.length > 0 && (
                                 <div className={`mt-4 pt-3 border-t border-gray-100 space-y-2 ${update.content.trim().length === 0 ? 'mt-0 pt-0 border-t-0' : ''}`}> {/* Adjust top margin if no content */}
                                     <p className="text-xs font-medium text-gray-500">Attached:</p>
                                     <ul className="list-none pl-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                         {update.attachments.map((att, index) => (
                                             <li key={att.url.startsWith('local:') ? `${att.name}-${index}` : att.url} className="text-sm">
                                                  {/* Link Attachments */}
                                                  {att.type === 'link' && (
                                                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1 rounded-md hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors break-all" title={att.url}>
                                                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 opacity-70"><path d="M8.75 4.75a.75.75 0 0 0-1.5 0v5.69L5.03 8.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 10.44V4.75Z" /><path d="M3.5 3.75a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2.25a.75.75 0 0 0 1.5 0V3.75a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 2 3.75v10.5a3.5 3.5 0 0 0 3.5 3.5h5a3.5 3.5 0 0 0 3.5-3.5V12a.75.75 0 0 0-1.5 0v2.25a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V3.75Z" /></svg>
                                                           <span className="truncate">{att.name}</span>
                                                      </a>
                                                  )}
                                                  {/* Temp File Placeholders (or future Storage links) */}
                                                  {/* Check for fileMetadata to identify temporary files */}
                                                  {att.fileMetadata && att.url.startsWith('local:') && (
                                                       <div className="flex items-center gap-2 p-2 text-gray-600 bg-gray-100 border border-gray-200 rounded-md italic opacity-80" title={`${att.name} (${(att.fileMetadata.size / 1024).toFixed(1)} KB)`}>
                                                            {att.type.startsWith('image/') ? '🖼️' : (att.type.includes('pdf') ? '📄' : '📦')} {/* Icons based on type */}
                                                            <span className="truncate">{att.name}</span>
                                                            <span className="ml-auto text-[10px]">(Preview Only)</span>
                                                        </div>
                                                   )}
                                                   {/* Handle actual file URLs from Storage in the future */}
                                                   {/* {!att.fileMetadata && !att.url.startsWith('local:') && att.url && (
                                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1 rounded-md hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors break-all" title={`Download: ${att.name}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 opacity-70"><path fillRule="evenodd" d="M8.5 2.25a.75.75 0 0 0-1.5 0v8.69L5.03 9.22a.75.75 0 1 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06L8.5 10.94V2.25Z" clipRule="evenodd" /></svg>
                                                            <span className="truncate">{att.name}</span>
                                                        </a>
                                                    )} */}
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                              )}
                         </div>
                     ))
                 )}
             </div>
        </div>
    );
};

export default LearningClassroomStream; // *** Export new component name ***