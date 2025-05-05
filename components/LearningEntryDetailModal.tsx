// components/LearningEntryDetailModal.tsx
"use client";

import React, { useState, useEffect, useMemo, FormEvent, KeyboardEvent } from 'react';
import { User } from 'firebase/auth';
// Import types for entry, custom fields, and feedback
import { StudentLearningEntry, CustomLearningField, LearningEntryFeedback, Attachment } from '@/lib/types/learning';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import Modal from '@/components/Modal'; // Assuming you have a generic Modal component
// Assuming markdown rendering is needed for some text fields (like tasks, planning, etc.)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // For GitHub-flavored markdown
import { format } from 'date-fns'; // For date formatting

// Placeholder component for rendering individual custom fields in detail view
// We will create this or just render inline
// import CustomFieldDetail from './CustomFieldDetail';

// Placeholder for confirmation modal (e.g., for deleting entry)
// import ConfirmationModal from './ConfirmationModal';

interface LearningEntryDetailModalProps {
    classroomId: string;
    entryId: string; // Entry ID is required for this modal
    currentUser: User | null;
    isTeacher: boolean; // Is the current user a teacher in this classroom?
    onClose: () => void; // Handler to close the modal
    onEdit: () => void; // Handler to switch to edit mode (calls parent handler)
    // onDeleteSuccess: () => void; // Handler to call after successful deletion (calls parent handler)
    // Note: We'll handle delete confirmation and the API call for delete *inside* this modal
}

const LearningEntryDetailModal: React.FC<LearningEntryDetailModalProps> = ({
    classroomId,
    entryId,
    currentUser,
    isTeacher,
    onClose,
    onEdit, // Used by student owner to open edit modal
    // onDeleteSuccess, // Used after deleting the entry
}) => {
    // --- Data State ---
    const [entry, setEntry] = useState<StudentLearningEntry | null>(null);
    const [feedback, setFeedback] = useState<LearningEntryFeedback[]>([]);
    const [customFields, setCustomFields] = useState<CustomLearningField[]>([]); // To render custom fields
    const [isLoadingEntry, setIsLoadingEntry] = useState(true); // Loading for entry + feedback
    const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(true); // Loading for custom fields
    const [error, setError] = useState<string | null>(null);

    // --- Feedback Form State (Teacher only) ---
    const [newFeedbackText, setNewFeedbackText] = useState('');
    const [newFeedbackGrade, setNewFeedbackGrade] = useState(''); // Or number, depending on type
    const [isPostingFeedback, setIsPostingFeedback] = useState(false);
    const [postFeedbackError, setPostFeedbackError] = useState<string | null>(null);

    // --- Delete Entry State ---
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingEntry, setIsDeletingEntry] = useState(false);
    const [deleteEntryError, setDeleteEntryError] = useState<string | null>(null);

    // --- Determine if current user is the entry owner ---
    // This is based on the fetched entry data and the current user's UID
    const isEntryOwner = useMemo(() => {
        if (!currentUser || !entry) return false;
        return entry.studentId === currentUser.uid;
    }, [currentUser, entry]); // Recalculate when currentUser or entry changes


    // --- Effects ---

    // Effect 1: Fetch Entry Data and Feedback
    useEffect(() => {
        // Need entryId, classroomId, and currentUser to fetch
        if (!entryId || !classroomId || !currentUser) {
             console.warn("Detail Modal Effect: Missing ID or user.");
             setError("Cannot load entry details.");
             setIsLoadingEntry(false);
             return;
        }

        console.log(`Detail Modal Effect: Fetching entry ${entryId} and feedback for classroom ${classroomId}...`);
        setIsLoadingEntry(true); // Start loading for both entry and feedback
        setError(null);
        setEntry(null); // Clear previous data
        setFeedback([]);

        const fetchData = async () => {
            try {
                const idToken = await currentUser.getIdToken(true);
                const headers = { 'Authorization': `Bearer ${idToken}` };

                // Fetch the entry details
                const entryResponse = await fetch(`/api/learning-classrooms/${classroomId}/learning-entries/${entryId}`, { headers });
                if (!entryResponse.ok) {
                     const errData = await entryResponse.json().catch(() => ({}));
                     throw new Error(errData.message || `Failed to fetch entry (${entryResponse.status})`);
                }
                const entryData = await entryResponse.json();
                if (entryData.entry) {
                    setEntry(entryData.entry);
                } else {
                    throw new Error("No entry data in response.");
                }

                // Fetch the feedback for this entry
                const feedbackResponse = await fetch(`/api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback`, { headers });
                 if (!feedbackResponse.ok) {
                     const errData = await feedbackResponse.json().catch(() => ({}));
                     // Log this error but don't necessarily stop rendering the entry if feedback fetch fails
                     console.error("Error fetching feedback:", feedbackResponse.status, errData);
                     // Optionally set a specific feedback error state: setFeedbackError(...)
                     setFeedback([]); // Ensure empty array on error
                 } else {
                     const feedbackData = await feedbackResponse.json();
                     if (feedbackData.feedback && Array.isArray(feedbackData.feedback)) {
                         // Sort feedback by date ascending
                         const sortedFeedback = feedbackData.feedback.sort((a: LearningEntryFeedback, b: LearningEntryFeedback) =>
                             new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime()
                         );
                         setFeedback(sortedFeedback);
                     } else {
                         console.warn("Received unexpected data format for feedback:", feedbackData);
                         setFeedback([]);
                     }
                 }


            } catch (err: any) {
                console.error(`❌ Error fetching entry ${entryId} or feedback:`, err);
                setError(err.message || "Could not load entry details.");
                setEntry(null); // Ensure entry is null on main fetch error
                setFeedback([]); // Ensure feedback is empty on main fetch error
            } finally {
                setIsLoadingEntry(false); // Loading for entry+feedback fetch complete
                console.log("Detail Modal Effect: Entry and feedback fetch complete.");
            }
        };

        fetchData();

    }, [classroomId, entryId, currentUser]); // Dependencies

    // Effect 2: Fetch Custom Field Definitions (Needed to render custom fields data)
     useEffect(() => {
          // Fetch custom fields once when modal opens and classroomId is available
         if (!classroomId) {
              console.warn("Detail Modal Custom Fields Effect: classroomId missing.");
              setError("Cannot load custom field definitions."); // Set general error or specific one
              setIsLoadingCustomFields(false);
              return;
         }
         console.log(`Detail Modal Custom Fields Effect: Fetching custom field definitions for classroom ${classroomId}...`);
         setIsLoadingCustomFields(true);
         setError(null); // Clear general errors
         setCustomFields([]); // Clear previous fields

         const fetchCustomFields = async () => {
             try {
                 // No auth needed for reading custom fields based on current rules (any member)
                  // But API still checks for authentication.
                  const idToken = await currentUser?.getIdToken(true); // Use optional chaining
                 const response = await fetch(`/api/learning-classrooms/${classroomId}/custom-fields`, {
                      headers: { 'Authorization': `Bearer ${idToken}` },
                 });
                 if (!response.ok) {
                     const errData = await response.json().catch(() => ({}));
                     throw new Error(errData.message || `Failed to fetch custom field definitions (${response.status})`);
                 }
                 const data = await response.json(); // Expects { customFields: [...] }
                 if (data.customFields && Array.isArray(data.customFields)) {
                      console.log(`Fetched ${data.customFields.length} custom field definitions.`);
                      // Sort custom fields by order for consistent display
                      const sortedCustomFields = data.customFields.sort((a: CustomLearningField, b: CustomLearningField) => (a.order ?? 0) - (b.order ?? 0));
                      setCustomFields(sortedCustomFields);
                 } else {
                     console.warn("Received unexpected data format for custom field definitions:", data);
                     setCustomFields([]);
                 }
             } catch (err: any) {
                 console.error("❌ Error fetching custom field definitions:", err);
                 setError(err.message || "Could not load custom field definitions.");
                 setCustomFields([]);
             } finally {
                 setIsLoadingCustomFields(false); // Loading for custom fields fetch complete
                 console.log("Detail Modal Custom Fields Fetch complete.");
             }
         };

         fetchCustomFields();

     }, [classroomId, currentUser]); // Dependencies: Fetch when classroomId changes or user auth changes


    // --- Feedback Handlers (Teacher Only) ---

    // Handle posting new feedback
    const handlePostFeedback = async (e?: FormEvent) => {
        e?.preventDefault();
        // Only allow posting if user is a teacher and feedback text is not empty
        if (!isTeacher || !currentUser || !newFeedbackText.trim()) {
             if (!isTeacher) setPostFeedbackError("Only teachers can post feedback.");
             else if (!currentUser) setPostFeedbackError("You must be logged in to post feedback.");
             else setPostFeedbackError("Feedback cannot be empty.");
            return;
        }
        // Optional: Validate grade format if needed

        setIsPostingFeedback(true);
        setPostFeedbackError(null);

        try {
            const idToken = await currentUser.getIdToken(true);
            const payload = {
                classroomId: classroomId, // Include IDs from path
                entryId: entryId,
                feedbackText: newFeedbackText.trim(),
                grade: newFeedbackGrade.trim() || undefined, // Include grade if provided, use undefined if empty string
            };
            console.log("Posting feedback payload:", payload);

             // *** Use the correct API endpoint for feedback ***
            const response = await fetch(`/api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                 // Handle specific forbidden error (e.g., not a teacher in this classroom)
                 if (response.status === 403) {
                     setPostFeedbackError("Permission denied. You may not be a teacher in this classroom.");
                 } else {
                    setPostFeedbackError(errData.message || `Failed to post feedback (${response.status})`);
                 }
                throw new Error(errData.message || `Failed to post feedback (${response.status})`);
            }

            const result = await response.json(); // Expect { message: ..., feedbackId: ... }
            console.log("Feedback posted successfully:", result);

            // Optimistically add the new feedback to the list
            // Or for simplicity, just refetch feedback
             refetchFeedback(); // Refetch the feedback list


            // Reset feedback form
            setNewFeedbackText('');
            setNewFeedbackGrade('');
            setPostFeedbackError(null);


        } catch (err: any) {
            console.error("❌ Error posting feedback:", err);
            setPostFeedbackError(err.message || "Could not post feedback.");
        } finally {
            setIsPostingFeedback(false);
        }
    };

     // Function to refetch the feedback list
     const refetchFeedback = useCallback(async () => {
         // Only refetch if we have IDs and a user
         if (!entryId || !classroomId || !currentUser) return;

         console.log("Refetching feedback...");
         setPostFeedbackError(null); // Clear post errors before refetch
         setError(null); // Clear general errors

         try {
             const idToken = await currentUser.getIdToken(true);
             const headers = { 'Authorization': `Bearer ${idToken}` };
             const feedbackResponse = await fetch(`/api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback`, { headers });

             if (!feedbackResponse.ok) {
                 const errData = await feedbackResponse.json().catch(() => ({}));
                  console.error("Error refetching feedback:", feedbackResponse.status, errData);
                 // Optionally set a specific feedback error state
                 setFeedback([]);
                 return;
             }
             const feedbackData = await feedbackResponse.json();
             if (feedbackData.feedback && Array.isArray(feedbackData.feedback)) {
                  const sortedFeedback = feedbackData.feedback.sort((a: LearningEntryFeedback, b: LearningEntryFeedback) =>
                      new Date(a.createdAt.toString()).getTime() - new Date(b.createdAt.toString()).getTime()
                  );
                 setFeedback(sortedFeedback);
                 console.log("Feedback refetch successful.");
             } else {
                 setFeedback([]);
             }

         } catch (err: any) {
             console.error("❌ Error refetching feedback:", err);
              // Optionally set a specific feedback error state: setFeedbackError(...)
             setFeedback([]);
         }
     }, [classroomId, entryId, currentUser]); // Dependencies for refetch

    // TODO: Add handlers for editing/deleting existing feedback items (requires API routes for PATCH/DELETE specific feedback)


    // --- Entry Action Handlers (Edit, Delete) ---

    // Handle clicking the Edit Entry button (calls parent handler)
    const handleEditEntry = () => {
        // Only allow student owner to edit (UI check)
        if (!isEntryOwner) {
            console.warn("Attempted to edit entry by non-owner.");
            // Optional: Show a message
            return;
        }
        console.log("Opening edit modal for entry:", entryId);
        onEdit(); // Call the parent handler to switch to edit mode/open form modal
    };

    // Handle clicking the Delete Entry button (shows confirmation)
    const handleDeleteEntryClick = () => {
        // Only allow student owner OR teacher member to delete (UI check)
        if (!isEntryOwner && !isTeacher) {
             console.warn("Attempted to delete entry by unauthorized user.");
             // Optional: Show a message
            return;
        }
        console.log("Showing delete confirmation for entry:", entryId);
        setShowDeleteConfirm(true); // Show the delete confirmation UI
    };

    // Handle confirming the delete action
    const handleConfirmDeleteEntry = async () => {
        // Ensure user is authorized (UI check) and we have IDs
        if ((!isEntryOwner && !isTeacher) || !entryId || !classroomId || !currentUser) {
             console.warn("Attempted to confirm delete entry by unauthorized user or missing info.");
             setDeleteEntryError("Authorization failed or missing info.");
             return;
        }

        setIsDeletingEntry(true); // Start deleting state
        setDeleteEntryError(null);

        try {
            const idToken = await currentUser.getIdToken(true);
            const headers = { 'Authorization': `Bearer ${idToken}` };

            console.log(`Deleting entry ${entryId} in classroom ${classroomId}...`);
             // *** Use the DELETE single entry API endpoint ***
            const response = await fetch(`/api/learning-classrooms/${classroomId}/learning-entries/${entryId}`, {
                method: 'DELETE',
                headers: headers,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                 // Handle specific forbidden error (e.g., not owner/teacher)
                 if (response.status === 403) {
                     setDeleteEntryError("Permission denied. You may not have rights to delete this entry.");
                 } else {
                    setDeleteEntryError(errData.message || `Failed to delete entry (${response.status})`);
                 }
                throw new Error(errData.message || `Failed to delete entry (${response.status})`);
            }

            console.log(`✅ Entry ${entryId} deleted successfully.`);
            // Call the parent handler to refetch entries and close the modal
            // onDeleteSuccess(); // Use handleModalClose instead which calls refetchEntries
             handleModalClose();


        } catch (err: any) {
            console.error("❌ Error deleting entry:", err);
            setDeleteEntryError(err.message || "Could not delete entry.");
        } finally {
            setIsDeletingEntry(false); // Stop deleting state
            setShowDeleteConfirm(false); // Hide confirmation modal regardless
        }
    };


    // --- Helper to display file info ---
    // Handles both temporary metadata and future URLs
    const renderFileInfo = (fileMetadata?: Attachment['fileMetadata'], fileUrl?: string | null, fileName?: string | null, typeHint?: string) => {
         if (fileUrl) {
             // If actual URL exists, display a download link
             const displayFileName = fileName || fileMetadata?.filename || 'Attached File';
             return (
                 <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline" title={`Download: ${displayFileName}`}>
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-70"><path fillRule="evenodd" d="M8.5 2.25a.75.75 0 0 0-1.5 0v8.69L5.03 9.22a.75.75 0 1 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 1 0-1.06-1.06L8.5 10.94V2.25Z" clipRule="evenodd" /></svg>
                     <span className="truncate max-w-[200px]">{displayFileName}</span>
                 </a>
             );
         } else if (fileMetadata) {
             // If only temporary metadata exists, display info with a note
             const displayFileName = fileMetadata.filename || fileName || 'Attached File';
              const fileSize = (fileMetadata.size / 1024).toFixed(1);
             return (
                 <span className="inline-flex items-center gap-1 text-gray-600 italic" title={`${displayFileName} (${fileSize} KB) - Not yet uploaded`}>
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-70"><path fillRule="evenodd" d="M.965 7.451a.75.75 0 0 1 .831.134l.91.91A6.481 6.481 0 0 0 3.8 6.176V3a1.5 1.5 0 0 1 3 0v.5H8V3a3 3 0 0 0-6 0v3.176l-.176-.176a.75.75 0 0 1-.134-.83ZM10 3.5h.5V3a1.5 1.5 0 0 1 3 0v3.176a6.483 6.483 0 0 0 1.124 2.32l.91-.91a.75.75 0 0 1 1.075.029.75.75 0 0 1-.029 1.075l-1.5 1.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 0 1 .029-1.075.75.75 0 0 1 1.075.029l.176.176V3.5Z" /></svg>
                     <span className="truncate max-w-[150px]">{displayFileName}</span>
                     <span className="text-[10px] whitespace-nowrap">({fileSize} KB)</span>
                 </span>
             );
         }
         return null; // Nothing to render if no info
    };


    // --- Render ---

    // Show a combined loading state for initial data fetch
    if (isLoadingEntry || isLoadingCustomFields) {
        // Re-use the parent Modal wrapper, passing isOpen=true
        return (
            <Modal isOpen={true} onClose={onClose} title="Loading Entry Details...">
                <div className="flex justify-center items-center py-8">
                    <LoadingSpinner />
                </div>
            </Modal>
        );
    }

     // Show error if initial fetch failed (either entry/feedback or custom fields)
    if (error || !entry) { // Also check if entry object is null/undefined after loading
         // Re-use the parent Modal wrapper, passing isOpen=true
         return (
             <Modal isOpen={true} onClose={onClose} title="Error Loading Entry">
                  <div className="py-4">
                     <ErrorMessage message={error || "Could not load entry data."} /> {/* Display specific error or a default */}
                      <p className="mt-4 text-center"><button onClick={onClose} className="text-blue-600 hover:underline">Close</button></p>
                  </div>
             </Modal>
         );
     }


    // Main Modal Content (when entry is loaded)
    // Use the generic Modal component
    // Modal visibility is controlled by parent's state (showEntryDetailModal)
    return (
        <Modal isOpen={true} onClose={onClose} title={`Entry: ${entry.title || 'Untitled'}`}>

            {/* Entry Details Section */}
            <div className="mb-6 space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Details</h3>

                {/* Standard Fields Display */}
                <div>
                    <p className="text-sm font-medium text-gray-700">Date:</p>
                    <p className="text-gray-900">{entry.entryDate ? format(new Date(entry.entryDate.toString()), 'PPP') : 'N/A'}</p> {/* Format date nicely */}
                </div>
                 {entry.weekNumber !== undefined && (
                     <div>
                        <p className="text-sm font-medium text-gray-700">Week Number:</p>
                        <p className="text-gray-900">{entry.weekNumber}</p>
                    </div>
                 )}
                 <div>
                    <p className="text-sm font-medium text-gray-700">Learning Type:</p>
                    <p className="text-gray-900">{entry.learningType || 'N/A'}</p>
                </div>
                 {/* Display Submission Status */}
                 <div>
                     <p className="text-sm font-medium text-gray-700">Status:</p>
                     <p className="text-gray-900">
                         {entry.isSubmitted ? 'Submitted' : 'Draft'}
                         {entry.isSubmitted && entry.submissionDate && (
                             <span className="text-xs text-gray-500 ml-2">(on {new Date(entry.submissionDate.toString()).toLocaleDateString()})</span>
                         )}
                     </p>
                 </div>
                 {entry.durationHours !== undefined && (
                     <div>
                        <p className="text-sm font-medium text-gray-700">Duration:</p>
                        <p className="text-gray-900">{entry.durationHours} Hours</p>
                    </div>
                 )}


                 {/* Text Areas (rendered with Markdown) */}
                 {/* Add vertical spacing between sections */}
                 <div className="pt-4 border-t border-gray-200">
                     <p className="text-sm font-medium text-gray-700 mb-1">Tasks Performed:</p>
                      <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                         {entry.tasksPerformed ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.tasksPerformed}</ReactMarkdown> : <p className="italic opacity-70">No tasks performed recorded.</p>}
                     </article>
                 </div>
                  <div className="pt-4 border-t border-gray-200">
                     <p className="text-sm font-medium text-gray-700 mb-1">Planning:</p>
                      <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                         {entry.planning ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.planning}</ReactMarkdown> : <p className="italic opacity-70">No planning recorded.</p>}
                     </article>
                 </div>
                  <div className="pt-4 border-t border-gray-200">
                     <p className="text-sm font-medium text-gray-700 mb-1">Next Steps:</p>
                      <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                         {entry.nextSteps ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.nextSteps}</ReactMarkdown> : <p className="italic opacity-70">No next steps recorded.</p>}
                     </article>
                 </div>
                  <div className="pt-4 border-t border-gray-200">
                     <p className="text-sm font-medium text-gray-700 mb-1">Challenges:</p>
                      <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                         {entry.challenges ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.challenges}</ReactMarkdown> : <p className="italic opacity-70">No challenges recorded.</p>}
                     </article>
                 </div>
                  <div className="pt-4 border-t border-gray-200">
                     <p className="text-sm font-medium text-gray-700 mb-1">Key Learning:</p>
                      <article className="prose prose-sm max-w-none text-gray-800 prose-a:text-blue-600 hover:prose-a:underline">
                         {entry.learning ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.learning}</ReactMarkdown> : <p className="italic opacity-70">No learning recorded.</p>}
                     </article>
                 </div>


                 {/* Links Display */}
                 {Array.isArray(entry.links) && entry.links.length > 0 && (
                     <div className="pt-4 border-t border-gray-200">
                         <p className="text-sm font-medium text-gray-700 mb-1">Relevant Links:</p>
                          <ul className="list-disc list-inside text-gray-800 space-y-0.5">
                             {entry.links.map((link, index) => (
                                 <li key={index} className="break-all">
                                     <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                         {link}
                                     </a>
                                 </li>
                             ))}
                          </ul>
                     </div>
                 )}

                 {/* Main Files Display (Report, Presentation, Certificate) */}
                 {(entry.reportFileMetadata || entry.reportFileUrl ||
                   entry.presentationFileMetadata || entry.presentationFileUrl ||
                   entry.certificateFileMetadata || entry.certificateFileUrl) && (
                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Main Files:</p>
                        <div className="flex flex-wrap gap-4">
                            {renderFileInfo(entry.reportFileMetadata, entry.reportFileUrl, 'Report File', 'document')}
                            {renderFileInfo(entry.presentationFileMetadata, entry.presentationFileUrl, 'Presentation File', 'presentation')}
                            {renderFileInfo(entry.certificateFileMetadata, entry.certificateFileUrl, 'Certificate File', 'certificate')}
                        </div>
                    </div>
                 )}


                {/* --- Custom Fields Display --- */}
                 {/* Render only fields that have data in the entry's customFieldsData */}
                 {customFields.length > 0 && entry.customFieldsData && Object.keys(entry.customFieldsData).length > 0 && (
                     <div className="pt-4 border-t border-gray-200 space-y-3">
                         <h3 className="text-lg font-semibold text-gray-800">Additional Details (Custom Fields)</h3>
                          {customFields
                             // Filter to only show fields where the entry actually has data
                            .filter(field => entry.customFieldsData?.[field.id] !== undefined && entry.customFieldsData?.[field.id] !== null && String(entry.customFieldsData?.[field.id]).trim() !== '')
                            .map(field => (
                             <div key={field.id}>
                                 <p className="text-sm font-medium text-gray-700">{field.fieldName}:</p>
                                 {/* TODO: Create CustomFieldDetail component or render inline */}
                                 {/* For now, render basic values */}
                                 {field.fieldType === 'checkbox' ? (
                                     <p className="text-gray-900">{entry.customFieldsData[field.id] ? 'Yes' : 'No'}</p>
                                 ) : field.fieldType === 'url' && entry.customFieldsData[field.id] ? (
                                      <a href={entry.customFieldsData[field.id]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                          {entry.customFieldsData[field.id]}
                                      </a>
                                 ) : field.fieldType === 'file' && entry.customFieldsData[field.id]?.filename ? (
                                      // Handle custom file fields - assuming customFieldsData.fieldId holds metadata or URL
                                      // Need to pass filename, size, type metadata or a URL
                                       renderFileInfo(
                                          entry.customFieldsData[field.id]?.fileMetadata || entry.customFieldsData[field.id], // Try fileMetadata first, fallback to data shape if it contains it
                                          entry.customFieldsData[field.id]?.fileUrl, // Check for a URL field
                                          entry.customFieldsData[field.id]?.filename, // Check for a filename field
                                          field.fieldName // Pass name as type hint
                                        )
                                 )
                                 : (
                                     <p className="text-gray-900 whitespace-pre-wrap">{String(entry.customFieldsData[field.id])}</p>
                                 )}
                             </div>
                          ))}
                          {/* Message if no custom fields have data, but definitions exist */}
                           {customFields.length > 0 && (!entry.customFieldsData || Object.keys(entry.customFieldsData).filter(key => entry.customFieldsData[key] !== undefined && entry.customFieldsData[key] !== null && String(entry.customFieldsData[key]).trim() !== '').length === 0) && (
                               <p className="italic text-sm text-gray-500">No data provided for additional details.</p>
                           )}
                     </div>
                 )}


            </div> {/* End Entry Details Section */}


            {/* Feedback Section */}
            <div className="mb-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Feedback</h3>

                {/* Feedback List */}
                {feedback.length === 0 ? (
                    <p className="text-sm italic text-gray-500 mb-4">No feedback yet.</p>
                ) : (
                    <div className="space-y-4 mb-4">
                        {feedback.map(item => (
                             // TODO: Create FeedbackItem component or render inline
                            <div key={item.id} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                                    <span className="font-medium text-gray-800">{item.teacherName || 'Teacher'}</span>
                                    ·
                                     <span title={new Date(item.createdAt.toString()).toLocaleString()}>
                                         {new Date(item.createdAt.toString()).toLocaleDateString()} {/* Simple date format */}
                                     </span>
                                    {item.grade !== undefined && item.grade !== null && (
                                        <> · <span>Grade: {item.grade}</span></>
                                    )}
                                     {/* TODO: Add Edit/Delete buttons for feedback (conditional on item.teacherId === currentUser.uid) */}
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.feedbackText}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Feedback Form (Teacher only) */}
                {/* Show form if current user is a teacher */}
                {isTeacher && currentUser && (
                    <form onSubmit={handlePostFeedback} className="space-y-3">
                         <h4 className="text-base font-semibold text-gray-800">Add Feedback</h4>
                         {postFeedbackError && <ErrorMessage message={postFeedbackError} />}
                         <div>
                             <label htmlFor="feedbackText" className="sr-only">Feedback Text</label>
                             <textarea
                                 id="feedbackText"
                                 value={newFeedbackText}
                                 onChange={(e) => setNewFeedbackText(e.target.value)}
                                 required
                                 rows={3}
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 resize-y"
                                 disabled={isPostingFeedback}
                                 placeholder="Enter your feedback..."
                             />
                         </div>
                          {/* Grade Input (Optional) */}
                          <div>
                              <label htmlFor="feedbackGrade" className="block text-sm font-medium text-gray-700 mb-1">Grade (Optional)</label>
                               <input
                                   type="text" // Can be text or number depending on grading scale
                                   id="feedbackGrade"
                                   value={newFeedbackGrade}
                                   onChange={(e) => setNewFeedbackGrade(e.target.value)}
                                   className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                                   disabled={isPostingFeedback}
                                   placeholder="e.g., A+, 95, Pass"
                               />
                          </div>
                         <div className="flex justify-end">
                             <button
                                 type="submit"
                                 className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                 disabled={isPostingFeedback || !newFeedbackText.trim()}
                             >
                                {isPostingFeedback ? 'Posting...' : 'Post Feedback'}
                             </button>
                         </div>
                    </form>
                )}
            </div> {/* End Feedback Section */}


            {/* Action Buttons Area (Edit/Delete Entry) */}
            {/* Show buttons based on user's relationship (owner or teacher) */}
            {((isEntryOwner && currentUser) || (isTeacher && currentUser)) && (
                 <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">

                     {/* Edit Button (Student Owner Only) */}
                     {isEntryOwner && currentUser && (
                         <button
                             onClick={handleEditEntry} // Calls parent's onEdit handler
                             className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus-within:ring-2 focus:ring-offset-2 focus-within:ring-offset-2 focus:ring-gray-400 focus-within:ring-gray-400 transition duration-150 text-sm flex items-center justify-center disabled:opacity-50"
                         >
                             Edit Entry
                         </button>
                     )}

                     {/* Delete Button (Student Owner OR Teacher) */}
                     {((isEntryOwner && currentUser) || (isTeacher && currentUser)) && (
                         <button
                             onClick={handleDeleteEntryClick} // Shows confirmation modal
                             className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus-within:ring-2 focus:ring-offset-2 focus-within:ring-offset-2 focus:ring-red-500 focus-within:ring-red-500 transition duration-150 text-sm font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                             disabled={isDeletingEntry}
                         >
                             {isDeletingEntry ? 'Deleting...' : 'Delete Entry'}
                         </button>
                     )}
                 </div>
            )}

             {/* Delete Confirmation Modal */}
             {showDeleteConfirm && (
                  <Modal isOpen={true} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion">
                     {/* Display deletion error if any */}
                      {deleteEntryError && <div className="mb-4"><ErrorMessage message={deleteEntryError} /></div>}
                      <p className="text-gray-700 mb-6">Are you sure you want to delete this learning entry?</p>
                      <div className="flex justify-end gap-4">
                          <button
                              onClick={() => setShowDeleteConfirm(false)}
                              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                              disabled={isDeletingEntry}
                          >
                             Cancel
                          </button>
                          <button
                              onClick={handleConfirmDeleteEntry}
                              className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 disabled:opacity-50"
                              disabled={isDeletingEntry}
                          >
                             {isDeletingEntry ? 'Deleting...' : 'Delete'}
                          </button>
                      </div>
                  </Modal>
             )}

        </Modal>
    );
};

export default LearningEntryDetailModal;