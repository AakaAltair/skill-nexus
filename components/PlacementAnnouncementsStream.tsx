// components/PlacementAnnouncementsStream.tsx
"use client";

import React, { useState, FormEvent, useEffect, useCallback, useRef, ChangeEvent, DragEvent } from 'react';
// Use PlacementUpdate type and potentially Attachment if you define it for placements
import { PlacementUpdate, Attachment } from '@/lib/types/placement'; // Adjust path if needed
import { User, getIdToken } from 'firebase/auth'; // Import auth types
import ReactMarkdown from 'react-markdown'; // To render markdown content
import remarkGfm from 'remark-gfm'; // Plugin for GitHub Flavored Markdown (tables, strikethrough, etc.)
import { formatTimestamp } from '@/lib/dateUtils'; // Relative time formatting (adjust path)
import linkifyIt from 'linkify-it'; // For automatically detecting links in text

// Initialize linkify
const linkify = linkifyIt();

// --- Component Props Interface ---
interface PlacementAnnouncementsStreamProps {
    driveId: string; // ID of the placement drive these updates belong to
    isOwner: boolean; // Can the current user post updates?
    initialUpdates: PlacementUpdate[]; // Updates fetched initially by the parent page
    currentUser: User | null; // Current logged-in user object
}

// --- Interface for temporary file info (used for file upload UI simulation) ---
interface TempFile {
    file: File;
    id: string; // Unique temporary ID for list key
    previewUrl?: string; // Data URL for image preview (optional)
}

// --- Placement Announcements Stream Component ---
const PlacementAnnouncementsStream: React.FC<PlacementAnnouncementsStreamProps> = ({
    driveId,
    isOwner,
    initialUpdates,
    currentUser
}) => {
    // --- State ---
    const [updates, setUpdates] = useState<PlacementUpdate[]>(initialUpdates); // Local state for updates list
    const [newUpdateContent, setNewUpdateContent] = useState(''); // State for the new update textarea
    const [isPostingUpdate, setIsPostingUpdate] = useState(false); // Loading state for posting
    const [updateError, setUpdateError] = useState<string | null>(null); // Error message state for posting/file handling
    const [tempFiles, setTempFiles] = useState<TempFile[]>([]); // State for files staged for upload (simulation)
    const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input
    const [isDragging, setIsDragging] = useState(false); // State for drag-and-drop UI feedback

    // --- Effect: Sync state with initial props ---
    // If the initialUpdates prop changes (e.g., parent refetches), update the local state
    useEffect(() => {
        setUpdates(initialUpdates);
    }, [initialUpdates]);

    // --- File Processing Logic (Simulation) ---
    // This function handles selecting files via input or drag-and-drop
    // It currently only manages temporary file state for display, not actual upload.
    const processFiles = useCallback((files: FileList | null | undefined) => {
        if (!files || files.length === 0 || !currentUser) return; // Basic checks

        const filesToProcess = Array.from(files);
        let currentError: string | null = null;
        const currentAttachmentCount = tempFiles.length;
        const MAX_FILES = 5;
        const MAX_SIZE_MB = 10;

        // Check total file count limit
        if (currentAttachmentCount + filesToProcess.length > MAX_FILES) {
            currentError = `Cannot attach more than ${MAX_FILES} files total.`;
            setUpdateError(currentError); // Show error immediately
            return; // Stop processing
        }

        const newTempFilesState: TempFile[] = [];
        const previewPromises: Promise<void>[] = [];

        filesToProcess.forEach(file => {
            // Check individual file size limit
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                // Set error only if no previous error was found in this batch
                if (!currentError) currentError = `File "${file.name}" ignored (exceeds ${MAX_SIZE_MB}MB).`;
                console.warn(`File "${file.name}" ignored (exceeds ${MAX_SIZE_MB}MB).`);
                return; // Skip this file
            }
            // TODO: Add MIME type validation if needed

            const newFileId = crypto.randomUUID(); // Unique ID for list key
            const newTempFile: TempFile = { file: file, id: newFileId };
            newTempFilesState.push(newTempFile); // Add to temporary array

            // Generate image previews
            if (file.type.startsWith("image/")) {
                 previewPromises.push(new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const index = newTempFilesState.findIndex(tf => tf.id === newFileId);
                        if(index !== -1 && typeof reader.result === 'string') {
                            newTempFilesState[index].previewUrl = reader.result; // Add preview URL
                        }
                        resolve(); // Resolve even if reading fails
                    }
                    reader.onerror = () => resolve(); // Handle errors
                    reader.readAsDataURL(file);
                }));
            }
        });

        // Update the main state with the files (without previews initially)
        setTempFiles(prev => [...prev, ...newTempFilesState]);
        // Set the first error encountered during processing this batch
        if(currentError) setUpdateError(currentError);

        // After all preview promises resolve, update the state again with previews
        if (previewPromises.length > 0) {
            Promise.all(previewPromises).then(() => {
                // Update the main tempFiles state array with the generated previewUrls
                 setTempFiles(currentFiles => currentFiles.map(tf => {
                    // Find the corresponding file with preview in our temporary batch
                    const updatedFile = newTempFilesState.find(ntf => ntf.id === tf.id && ntf.previewUrl);
                    return updatedFile ? updatedFile : tf; // Return updated file or original
                 }));
                console.log("Image previews processed for update form.");
            });
        }
    }, [currentUser, tempFiles.length]); // Dependencies: run when user or file count changes


    // --- Event Handlers for File Input and Drag/Drop ---
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        processFiles(event.target.files);
        // Reset file input to allow selecting the same file again
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    const handleRemoveTempFile = (fileIdToRemove: string) => {
        // Revoke object URL if it was created for preview (optional memory management)
        // const fileToRemove = tempFiles.find(tf => tf.id === fileIdToRemove);
        // if (fileToRemove?.previewUrl?.startsWith('blob:')) { URL.revokeObjectURL(fileToRemove.previewUrl); }
        setTempFiles(prev => prev.filter(tf => tf.id !== fileIdToRemove));
    };
    // Drag handlers for UI feedback
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }; // Keep true while over
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false); // Reset dragging state
        processFiles(e.dataTransfer.files); // Process the dropped files
    };


    // --- Handler for Posting a New Update ---
    const handlePostUpdate = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent default form submission
        const contentToPost = newUpdateContent.trim();
        // Check authorization and if content or files exist
        if (!isOwner || !currentUser || (!contentToPost && tempFiles.length === 0)) {
            if (!contentToPost && tempFiles.length === 0) setUpdateError("Please enter update content or attach a file.");
            return;
        }
        setIsPostingUpdate(true); // Set loading state
        setUpdateError(null); // Clear previous errors

        // --- Attachment Simulation ---
        // Detect links in the text content
        const detectedLinks = linkify.match(contentToPost) || [];
        // Create Attachment objects for links
        const linkAttachments: Attachment[] = detectedLinks.map(match => ({
            name: match.text, url: match.url, type: 'link' as const
        }));
        // Create placeholder Attachment objects for files (replace URL later)
        const fileAttachments: Attachment[] = tempFiles.map(tf => ({
            name: tf.file.name,
            url: `local-placeholder:${tf.file.name}`, // Placeholder URL
            type: tf.file.type.startsWith('image/') ? 'image' : 'file', // Basic type detection
            size: tf.file.size // Include file size
        }));
        // Combine all attachments
        const allAttachments = [...linkAttachments, ...fileAttachments];
        // --- End Attachment Simulation ---

        try {
            const idToken = await getIdToken(currentUser, true); // Get fresh auth token
            // Prepare payload for the API
            const payload = {
                content: contentToPost,
                attachments: allAttachments // Send the simulated attachment metadata
            };
            console.log("Posting Placement Update Payload:", payload);

            // Call the placement-specific API endpoint for updates
            const response = await fetch(`/api/placement/drives/${driveId}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(payload)
            });

            // Handle API response errors
            if (!response.ok) {
                let errorDetails = `Post failed (${response.status})`;
                try { const errData = await response.json(); errorDetails = errData.error || errData.details || errorDetails; }
                catch (parseError) { errorDetails = response.statusText || errorDetails; }
                throw new Error(errorDetails);
            }
            const result = await response.json(); // Expect { message: ..., updateId: ... }

            // --- TODO: Implement Actual File Upload Logic ---
            // This section would handle uploading files in `tempFiles` to storage
            // and potentially updating the Firestore document with real URLs.
            console.warn("File Upload Skipped: Actual upload logic not implemented in this version.");
            console.log("Simulated file upload for:", tempFiles.map(f => f.file.name));
            // --- End TODO ---

            // --- Optimistic UI Update ---
            // Create a new update object locally to display immediately
            const optimisticUpdate: PlacementUpdate = {
                id: result.updateId || crypto.randomUUID(), // Use returned ID or generate temp one
                authorId: currentUser.uid,
                authorName: currentUser.displayName || 'You',
                authorPhotoURL: currentUser.photoURL || '/default-avatar.png',
                content: contentToPost,
                createdAt: new Date().toISOString(), // Use current time for optimistic UI
                attachments: allAttachments, // Display simulated attachments for now
            };
            // Add the new update to the beginning of the updates list
            setUpdates(prevUpdates => [optimisticUpdate, ...prevUpdates]);
            // Reset the form fields
            setNewUpdateContent('');
            setTempFiles([]);
            setUpdateError(null);

        } catch (err: any) {
            console.error("❌ Post placement update error:", err);
            setUpdateError(err.message || "Could not post update. Please try again.");
        } finally {
            setIsPostingUpdate(false); // Stop loading indicator
        }
     };

    // --- Styling Variables ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 disabled:opacity-60";
    const postButtonStyle = "px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[90px]"; // Added min-width
    const cancelButtonStyle = "px-4 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 disabled:opacity-50";
    const removeButtonStyle = "text-gray-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-100 flex-shrink-0 transition-colors disabled:opacity-50";
    const isUploading = isPostingUpdate; // Alias for disabling file inputs during post

    // --- Render Component ---
    return (
        <div className="space-y-6">
             {/* --- Post Update Form --- */}
             {/* Show form only if the current user is the owner/poster */}
             {isOwner && currentUser && (
                 <form onSubmit={handlePostUpdate} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                    {/* User Avatar + Textarea */}
                    <div className="flex items-start gap-3">
                        <img src={currentUser.photoURL || '/default-avatar.png'} alt="Your avatar" className="w-9 h-9 rounded-full border flex-shrink-0 mt-1"/>
                        <textarea
                            id={`placementUpdate-${driveId}`} // Unique ID for label/accessibility
                            value={newUpdateContent}
                            onChange={(e) => setNewUpdateContent(e.target.value)}
                            className={`${inputStyle} min-h-[80px]`}
                            placeholder="Post an update, announcement, or news about this drive..."
                            rows={3}
                            disabled={isPostingUpdate}
                            required={tempFiles.length === 0} // Text required only if no files attached
                        />
                    </div>

                     {/* --- Attachment Area with Drag and Drop --- */}
                     <div className="pl-12 space-y-3"> {/* Indent attachment area */}
                        {/* Drop Zone */}
                        <div
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors duration-200 ${ isDragging ? 'border-blue-500 bg-blue-50/80' : 'border-gray-300 hover:border-gray-400 bg-white' }`}
                        >
                            {/* Clickable label for file input */}
                            <label htmlFor={`file-upload-placement-${driveId}`} className={`cursor-pointer w-full flex flex-col items-center text-gray-500 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`}>
                                 {/* Upload Icon */}
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                                 <span className={`text-sm font-medium ${isDragging ? 'text-blue-700' : 'text-gray-600'}`}> Drag & drop files or <span className="text-blue-600 font-semibold">browse</span> </span>
                                 <span className="text-xs text-gray-400 mt-1">Max 5 files, 10MB each (Upload Coming Soon)</span>
                            </label>
                            {/* Hidden file input */}
                            <input id={`file-upload-placement-${driveId}`} name="file-upload-placement" type="file" className="sr-only" ref={fileInputRef} onChange={handleFileChange} multiple disabled={isUploading || isPostingUpdate} accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx" />
                        </div>

                         {/* Display List of Staged Files */}
                         {tempFiles.length > 0 && (
                            <div className="space-y-2 pt-3 border-t border-gray-100">
                                <p className="text-xs font-medium text-gray-600">Files to attach:</p>
                                <ul className="list-none pl-0 space-y-1.5">
                                    {tempFiles.map((tf) => (
                                        <li key={tf.id} className="flex justify-between items-center text-sm bg-gray-50/80 p-1.5 pl-2.5 rounded border border-gray-200/80 text-gray-700">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {tf.previewUrl ? ( <img src={tf.previewUrl} alt="Preview" className="w-7 h-7 object-cover rounded flex-shrink-0 bg-gray-200 border"/> ) : ( <span className="flex-shrink-0 w-6 h-6 text-gray-500 text-xl leading-none">{/* Emoji Icon based on type */} {tf.file.type.startsWith('image/') ? '🖼️' : tf.file.type === 'application/pdf' ? '📕' : tf.file.type.includes('spreadsheet') || tf.file.type.includes('excel') ? '📊' : tf.file.type.includes('presentation') || tf.file.type.includes('powerpoint') ? '📽️' : tf.file.type.includes('word') ? '📝' : tf.file.type.includes('zip') || tf.file.type.includes('compressed') ? '📦' : '📄'}</span> )}
                                                <span className="truncate" title={tf.file.name}>{tf.file.name}</span>
                                                <span className="text-gray-400 text-[10px] flex-shrink-0">({ (tf.file.size / 1024).toFixed(1) } KB)</span>
                                            </div>
                                            <button type="button" onClick={() => handleRemoveTempFile(tf.id)} className={removeButtonStyle} title="Remove file" disabled={isPostingUpdate || isUploading}> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg> </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                         )}
                         {/* Display Posting Error */}
                         {updateError && <p className="text-xs text-red-600 mt-1">{updateError}</p>}
                     </div>

                     {/* Form Action Buttons */}
                     <div className="flex justify-end items-center gap-3 pt-3 border-t border-gray-100">
                         <button type="button" onClick={() => { setNewUpdateContent(''); setTempFiles([]); setUpdateError(null); }} disabled={isPostingUpdate} className={cancelButtonStyle}>Cancel</button>
                         <button type="submit" className={postButtonStyle} disabled={isPostingUpdate || isUploading || (!newUpdateContent.trim() && tempFiles.length === 0)}>
                             {/* Loading Spinner */}
                             {isPostingUpdate ? (<svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V..." className="opacity-75" fill="currentColor"></path></svg>) : null}
                             {isPostingUpdate ? 'Posting...' : 'Post Update'}
                         </button>
                     </div>
                 </form>
             )}
             {/* --- End Post Update Form --- */}

             {/* --- Updates Feed --- */}
             <div className="space-y-5">
                 <h3 className="text-xl font-semibold text-gray-800 px-1 mb-3">Drive Updates / News</h3>
                 {/* Display updates or empty state */}
                 {updates.length > 0 ? (
                     updates.map(update => ( // Maps over PlacementUpdate[] state
                         <div key={update.id || crypto.randomUUID()} className="bg-white p-5 border border-gray-200/80 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-150">
                             {/* Update Header */}
                             <div className="flex items-center gap-2.5 mb-3 text-sm">
                                 <img src={update.authorPhotoURL || '/default-avatar.png'} alt={update.authorName} className="w-9 h-9 rounded-full border flex-shrink-0"/>
                                 <div>
                                     <span className="font-semibold text-gray-900 block truncate">{update.authorName}</span>
                                     <span className="text-gray-500 text-xs" title={new Date(update.createdAt.toString()).toLocaleString()}> {formatTimestamp(update.createdAt)} </span>
                                 </div>
                             </div>
                             {/* Update Content (Rendered as Markdown) */}
                             <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
                             </article>
                             {/* Attachments Display (Simulated Placeholders) */}
                             {update.attachments && update.attachments.length > 0 && (
                                 <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                                     <p className="text-xs font-medium text-gray-500">Attached:</p>
                                     <ul className="list-none pl-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                         {update.attachments.map((att, index) => (
                                             <li key={att.url.startsWith('local-placeholder:') ? `${att.name}-${index}` : att.url} className="text-sm">
                                                  {/* Link Attachment */}
                                                  {att.type === 'link' && ( <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1 rounded-md hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors break-all" title={att.url}> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 opacity-70"><path d="M8.75 4.75a.75.75 0 0 0-1.5 0v5.69L5.03 8.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 10.44V4.75Z" /><path d="M3.5 3.75a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2.25a.75.75 0 0 0 1.5 0V3.75a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 2 3.75v10.5a3.5 3.5 0 0 0 3.5 3.5h5a3.5 3.5 0 0 0 3.5-3.5V12a.75.75 0 0 0-1.5 0v2.25a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V3.75Z" /></svg> <span className="truncate">{att.name}</span> </a> )}
                                                  {/* Temp File Placeholder */}
                                                  {(att.type === 'file' || att.type === 'image') && att.url.startsWith('local-placeholder:') && ( <div className="flex items-center gap-2 p-2 text-gray-600 bg-gray-100 border border-gray-200 rounded-md italic opacity-80" title={att.name}>{att.type === 'image' ? '🖼️' : '📄'} <span className="truncate">{att.name}</span> <span className="ml-auto text-[10px]">(Preview Only)</span></div> )}
                                                  {/* TODO: Add rendering for REAL uploaded files (links to downloadURL) here when storage is implemented */}
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                              )}
                         </div>
                     ))
                 ) : (
                    // Empty state message if no updates exist
                    <div className="bg-white p-4 border border-dashed border-gray-200 rounded-lg text-center text-gray-500 text-sm">
                        No updates have been posted for this drive yet.
                    </div>
                )}
             </div>
        </div> // Close main stream div
    );
};

export default PlacementAnnouncementsStream;