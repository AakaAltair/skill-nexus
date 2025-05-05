// components/ResourceAnnouncementsStream.tsx
"use client";

import React, { useState, FormEvent, useEffect, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
// *** Use ResourceUpdate type ***
// Assuming Attachment type is defined in resource types or reuse from project types if identical
import { ResourceUpdate, Attachment } from '@/lib/types/resource';
import { User, getIdToken } from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatTimestamp } from '@/lib/dateUtils'; // Adjust path if needed
import linkifyIt from 'linkify-it';

const linkify = linkifyIt();

interface ResourceAnnouncementsStreamProps { // *** Renamed interface ***
    resourceId: string; // *** Changed prop name ***
    isOwner: boolean;
    initialUpdates: ResourceUpdate[]; // *** Changed type ***
    currentUser: User | null;
}

// Interface for temporary file info held in state (Keep as is for simulation)
interface TempFile {
    file: File;
    id: string;
    previewUrl?: string;
}

// Helper: Simple Icon Components (Assuming these are defined elsewhere or keep if needed)
// const IconBold = ... ; const IconItalic = ... ; etc.

const ResourceAnnouncementsStream: React.FC<ResourceAnnouncementsStreamProps> = ({ // *** Use new props interface ***
    resourceId, isOwner, initialUpdates, currentUser // *** Use resourceId ***
}) => {
    // --- State ---
    const [updates, setUpdates] = useState<ResourceUpdate[]>(initialUpdates); // *** Use ResourceUpdate type ***
    const [newUpdateContent, setNewUpdateContent] = useState('');
    const [isPostingUpdate, setIsPostingUpdate] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [tempFiles, setTempFiles] = useState<TempFile[]>([]); // Keep for file simulation
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Sync updates with initial prop
    useEffect(() => { setUpdates(initialUpdates); }, [initialUpdates]);

    // --- File Processing Logic --- (Keep identical for now, just simulates)
    const processFiles = useCallback((files: FileList | null | undefined) => {
        if (!files || files.length === 0 || !currentUser) return;
        const filesToProcess = Array.from(files);
        let currentError: string | null = null;
        const currentAttachmentCount = tempFiles.length;
        // Basic validation (can be refined)
        if (currentAttachmentCount + filesToProcess.length > 5) { currentError = "Max 5 file attachments allowed."; setUpdateError(currentError); return; }

        const newTempFilesState: TempFile[] = [];
        const previewPromises: Promise<void>[] = [];
        filesToProcess.forEach(file => {
            if (file.size > 10 * 1024 * 1024) { currentError = `File "${file.name}" ignored (exceeds 10MB).`; return; } // Simple size check
            const newFileId = crypto.randomUUID();
            const newTempFile: TempFile = { file: file, id: newFileId };
            newTempFilesState.push(newTempFile);
            if (file.type.startsWith("image/")) {
                 previewPromises.push(new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const index = newTempFilesState.findIndex(tf => tf.id === newFileId);
                        if(index !== -1 && typeof reader.result === 'string') { newTempFilesState[index].previewUrl = reader.result; }
                        resolve();
                    };
                    reader.onerror = () => resolve();
                    reader.readAsDataURL(file);
                }));
            }
        });
        setTempFiles(prev => [...prev, ...newTempFilesState]);
        setUpdateError(currentError); // Show first error
        if (previewPromises.length > 0) {
            Promise.all(previewPromises).then(() => {
                setTempFiles(currentFiles => currentFiles.map(tf => { const updatedFile = newTempFilesState.find(ntf => ntf.id === tf.id && ntf.previewUrl); return updatedFile ? updatedFile : tf; }));
            });
        }
    }, [currentUser, tempFiles.length]);


    // --- Event Handlers --- (Keep identical)
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => { processFiles(event.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; };
    const handleRemoveTempFile = (fileIdToRemove: string) => { setTempFiles(prev => prev.filter(tf => tf.id !== fileIdToRemove)); };
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDragging(false); };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); processFiles(e.dataTransfer.files); };


    // --- Handle Posting New Update ---
    const handlePostUpdate = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const contentToPost = newUpdateContent.trim();
        // Require content or files
        if (!isOwner || !currentUser || (!contentToPost && tempFiles.length === 0)) {
            if (!contentToPost && tempFiles.length === 0) setUpdateError("Please enter content or attach a file.");
            return;
        }
        setIsPostingUpdate(true); setUpdateError(null);

        // Simulate attachments (same structure as before)
        const detectedLinks = linkify.match(contentToPost) || [];
        // Ensure Attachment type is compatible or adjust if needed
        const linkAttachments: Attachment[] = detectedLinks.map(match => ({ name: match.text, url: match.url, type: 'link' as const }));
        const fileAttachments: Attachment[] = tempFiles.map(tf => ({ name: tf.file.name, url: `local:${tf.file.name}`, type: tf.file.type.startsWith('image/') ? 'image' : 'file' }));
        const allAttachments = [...linkAttachments, ...fileAttachments];

        try {
            const idToken = await getIdToken(currentUser, true);
            const payload = {
                content: contentToPost,
                attachments: allAttachments // Send simulated attachments
            };
            console.log("Posting Resource Update Payload:", payload);

            // *** CHANGE API ENDPOINT to use resourceId ***
            const response = await fetch(`/api/resources/${resourceId}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(()=>{ return { error: `API Error ${response.status}` }});
                throw new Error(errData.error || `Post failed (${response.status})`);
            }
            const result = await response.json(); // Expect { message: ..., updateId: ... }

            // *** TODO: Actual file upload logic would go here eventually ***
            console.log("Simulating file upload for resource update:", tempFiles.map(f => f.file.name));

            // Optimistic Update using ResourceUpdate type
            const optimisticUpdate: ResourceUpdate = { // *** Use ResourceUpdate type ***
                id: result.updateId || crypto.randomUUID(), // Use returned ID or temp ID
                authorId: currentUser.uid,
                authorName: currentUser.displayName || 'You',
                authorPhotoURL: currentUser.photoURL || '/default-avatar.png',
                content: contentToPost,
                createdAt: new Date().toISOString(), // Use ISO string for client-side consistency
                attachments: allAttachments, // Keep simulated attachments
            };
            // Add the new update to the top of the list
            setUpdates(prevUpdates => [optimisticUpdate, ...prevUpdates]);
            // Reset form state
            setNewUpdateContent('');
            setTempFiles([]);
            setUpdateError(null);

        } catch (err: any) {
            console.error("❌ Post resource update error:", err);
            setUpdateError(err.message || "Could not post update.");
        } finally {
            setIsPostingUpdate(false);
        }
     };

    // --- Styling Variables --- (Keep identical)
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 text-black outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition duration-150 disabled:opacity-60";
    const postButtonStyle = "px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center";
    const cancelButtonStyle = "px-4 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 disabled:opacity-50";
    const removeButtonStyle = "text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-100 flex-shrink-0 transition-colors disabled:opacity-50";
    const isUploading = isPostingUpdate; // Keep simple alias

    // --- Render ---
    return (
        <div className="space-y-6">
             {/* Post Update Form */}
             {isOwner && currentUser && (
                 <form onSubmit={handlePostUpdate} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm mb-6 space-y-4">
                    {/* Avatar + Textarea */}
                    <div className="flex items-start gap-3">
                         <img src={currentUser.photoURL || '/default-avatar.png'} alt="Your avatar" className="w-8 h-8 rounded-full border flex-shrink-0 mt-1"/>
                         <textarea
                             id={`resourceUpdate-${resourceId}`} // Unique ID per resource
                             value={newUpdateContent}
                             onChange={(e) => setNewUpdateContent(e.target.value)}
                             className={`${inputStyle} min-h-[80px]`}
                             // *** Update placeholder text ***
                             placeholder="Post an update about this resource..."
                             rows={3}
                             disabled={isPostingUpdate}
                             required={tempFiles.length === 0} // Required only if no files attached
                         />
                    </div>

                     {/* Attachment Area (Identical JSX structure) */}
                     <div className="pl-11 space-y-3">
                         {/* Drop Zone */}
                         <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors duration-200 ${isDragging ? 'border-blue-500 bg-blue-50/80' : 'border-gray-300 hover:border-gray-400 bg-white'}`}>
                             <label htmlFor={`file-upload-resource-${resourceId}`} className={`cursor-pointer w-full flex flex-col items-center text-gray-500 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                                <span className={`text-sm font-medium ${isDragging ? 'text-blue-700' : 'text-gray-600'}`}> Drag & drop files or <span className="text-blue-600 font-semibold">browse</span> </span>
                                <span className="text-xs text-gray-400 mt-1">Max 5 files, 10MB each</span>
                            </label>
                             <input id={`file-upload-resource-${resourceId}`} name="file-upload-resource" type="file" className="sr-only" ref={fileInputRef} onChange={handleFileChange} multiple disabled={isUploading || isPostingUpdate} accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.csv,.xls,.xlsx,.ppt,.pptx" />
                         </div>
                         {/* Display Draft Temp Files (Identical JSX structure) */}
                         {tempFiles.length > 0 && ( <div className="space-y-2 pt-3 border-t border-gray-100"> <p className="text-xs font-medium text-gray-600">Files to attach:</p><ul className="list-none pl-0 space-y-2">{tempFiles.map((tf) => ( <li key={tf.id} className="flex justify-between items-center text-sm bg-gray-50/80 p-1.5 pl-2.5 rounded border border-gray-200/80"> <div className="flex items-center gap-2 min-w-0">{tf.previewUrl ? ( <img src={tf.previewUrl} alt="Preview" className="w-7 h-7 object-cover rounded flex-shrink-0 bg-gray-200 border"/>) : ( <span className="flex-shrink-0 w-6 h-6 text-gray-500 text-xl leading-none">{/* File type icons */}</span>)} <span className="truncate" title={tf.file.name}>{tf.file.name}</span> <span className="text-gray-400 text-[10px] flex-shrink-0">({ (tf.file.size / 1024).toFixed(1) } KB)</span></div><button type="button" onClick={() => handleRemoveTempFile(tf.id)} className={removeButtonStyle} title="Remove" disabled={isPostingUpdate || isUploading}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg></button> </li> ))}</ul> </div> )}
                         {/* General Update Error Display */}
                         {updateError && <p className="text-xs text-red-600 mt-1">{updateError}</p>}
                     </div>
                     {/* Post Update Button Area (Identical JSX Structure) */}
                     <div className="flex justify-end items-center gap-3 pt-3 border-t border-gray-100">
                         <button type="button" onClick={() => { setNewUpdateContent(''); setTempFiles([]); setUpdateError(null); }} disabled={isPostingUpdate} className={cancelButtonStyle}>Cancel</button>
                         <button type="submit" className={postButtonStyle} disabled={isPostingUpdate || isUploading || (!newUpdateContent.trim() && tempFiles.length === 0)}>
                             {isPostingUpdate ? (<svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V..." className="opacity-75" fill="currentColor"></path></svg>) : null}
                             {isPostingUpdate ? 'Posting...' : 'Post Update'}
                         </button>
                     </div>
                 </form>
             )}

             {/* --- Updates Feed --- */}
             <div className="space-y-5">
                 {/* Use a slightly different heading */}
                 <h3 className="text-xl font-semibold text-gray-800 px-1 mb-3">Resource History / Updates</h3>
                 {updates.length > 0 ? (
                     updates.map(update => ( // Maps over ResourceUpdate[] state
                         <div key={update.id} className="bg-white p-5 border border-gray-200/80 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-150">
                             {/* Update Header (Identical JSX Structure) */}
                             <div className="flex items-center gap-2.5 mb-3 text-sm">
                                 <img src={update.authorPhotoURL || '/default-avatar.png'} alt={update.authorName} className="w-9 h-9 rounded-full border flex-shrink-0"/>
                                 <div><span className="font-semibold text-black block truncate">{update.authorName}</span><span className="text-gray-500 text-xs" title={new Date(update.createdAt.toString()).toLocaleString()}> {formatTimestamp(update.createdAt)} </span></div>
                             </div>
                             {/* Update Content (Identical JSX Structure) */}
                             <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content}</ReactMarkdown>
                             </article>
                             {/* Display Attachments (Identical JSX structure, uses simulated data) */}
                             {update.attachments && update.attachments.length > 0 && (
                                 <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                                     <p className="text-xs font-medium text-gray-500">Attached:</p>
                                     <ul className="list-none pl-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                         {update.attachments.map((att, index) => (
                                             <li key={att.url.startsWith('local:') ? `${att.name}-${index}` : att.url} className="text-sm">
                                                  {/* Link Attachments */}
                                                  {att.type === 'link' && ( <a href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1 rounded-md hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors break-all" title={att.url}> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0 opacity-70"><path d="M8.75 4.75a.75.75 0 0 0-1.5 0v5.69L5.03 8.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 10.44V4.75Z" /><path d="M3.5 3.75a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2.25a.75.75 0 0 0 1.5 0V3.75a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 2 3.75v10.5a3.5 3.5 0 0 0 3.5 3.5h5a3.5 3.5 0 0 0 3.5-3.5V12a.75.75 0 0 0-1.5 0v2.25a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V3.75Z" /></svg> <span className="truncate">{att.name}</span> </a> )}
                                                  {/* Temp File Placeholders */}
                                                  {(att.type === 'file' || att.type === 'image') && att.url.startsWith('local:') && ( <div className="flex items-center gap-2 p-2 text-gray-600 bg-gray-100 border border-gray-200 rounded-md italic opacity-80" title={att.name}>{att.type === 'image' ? '🖼️' : '📄'} <span className="truncate">{att.name}</span> <span className="ml-auto text-[10px]">(Preview Only)</span></div> )}
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                              )}
                         </div>
                     ))
                 ) : (
                    // Update empty state message
                    <div className="bg-white p-4 border border-dashed border-gray-200 rounded-lg text-center text-gray-500 text-sm">
                        No updates have been posted for this resource yet.
                    </div>
                )}
             </div>
        </div>
    );
};

export default ResourceAnnouncementsStream; // *** Export new component name ***