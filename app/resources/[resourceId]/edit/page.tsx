// app/resources/[resourceId]/edit/page.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase';
// *** Import Resource types ***
import { Resource, ResourceType } from '@/lib/types/resource';

// Define available options for ResourceType
const resourceTypeOptions: ResourceType[] = [
    'Notes', 'Question Bank', 'Research Paper', 'Video',
    'Link Collection', 'Book PDF', 'Presentation', 'Code Repository', 'Other'
];
// No status options needed for resources

export default function EditResourcePage() {
    const params = useParams();
    const router = useRouter();
    const auth = getAuth(app);

    // --- State Variables ---
    const [initialResourceData, setInitialResourceData] = useState<Resource | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // --- Form State (Adjusted for Resource) ---
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [linkURL, setLinkURL] = useState(''); // Changed from file to URL
    const [resourceType, setResourceType] = useState<ResourceType>(resourceTypeOptions[0]);
    const [branch, setBranch] = useState('');
    const [year, setYear] = useState('');
    const [college, setCollege] = useState('');
    const [subject, setSubject] = useState('');
    const [tagsInput, setTagsInput] = useState(''); // Use tagsInput
    const [commentsEnabled, setCommentsEnabled] = useState(true); // Keep comments toggle

    // Extract resourceId safely
    const resourceId = typeof params?.resourceId === 'string' ? params.resourceId : undefined;

    // --- Effect: Auth Listener --- (Identical)
    useEffect(() => {
        setIsLoadingData(true); // Start loading on auth check
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true); // Mark auth check complete
        });
        return () => unsubscribe();
    }, [auth]);

    // --- Effect: Fetch Resource Data ---
    useEffect(() => {
        // Wait for resourceId and auth check
        if (!resourceId || !authChecked) {
            if (!resourceId && authChecked) { setError("Invalid Resource ID."); setIsLoadingData(false); }
            return;
        }
        let isMounted = true;
        setIsLoadingData(true);
        setError(null); setInitialResourceData(null); setIsOwner(false); // Reset states

        async function loadResource() {
            try {
                // *** Fetch from resource API endpoint ***
                const response = await fetch(`/api/resources/${resourceId}`);
                if (!isMounted) return;

                if (response.status === 404) throw new Error("Resource not found.");
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API Error: ${response.status}`);
                }
                const data = await response.json();
                // *** Expect { resource: ... } structure ***
                if (!data.resource) throw new Error("Invalid data format received.");
                if (!isMounted) return;

                const fetchedResource: Resource = data.resource;
                setInitialResourceData(fetchedResource);

                // Populate Form State with Resource Data
                setTitle(fetchedResource.title);
                setDescription(fetchedResource.description || '');
                setLinkURL(fetchedResource.linkURL); // Populate link URL
                setResourceType(fetchedResource.resourceType);
                setBranch(fetchedResource.branch || '');
                setYear(fetchedResource.year || '');
                setCollege(fetchedResource.college || '');
                setSubject(fetchedResource.subject || '');
                setTagsInput(fetchedResource.tags?.join(', ') || ''); // Join tags array
                setCommentsEnabled(fetchedResource.commentsEnabled !== false); // Default true

                // Check Ownership (uses uploaderId for resources)
                if (user && user.uid === fetchedResource.uploaderId) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                    // Set error message based on whether user is logged in
                    setError(user ? "Permission denied: You are not the owner of this resource." : "Please log in to edit this resource.");
                }
            } catch (err: any) {
                 if (isMounted) setError(err.message);
                 setIsOwner(false); // Ensure owner is false on error
            } finally {
                 if (isMounted) setIsLoadingData(false); // Stop loading
            }
        }
        // Only attempt to load if user state is resolved (either null or a user object)
        if (authChecked) {
            loadResource();
        }

        return () => { isMounted = false; }; // Cleanup
    // Depend on user object as well to re-check ownership if user logs in/out
    }, [resourceId, authChecked, user]);

    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Ensure owner, user, initial data, and ID are present
        if (!isOwner || !user || !initialResourceData || !resourceId) {
            setError("Cannot submit form: Not authorized or essential data missing.");
            return;
        }
        setIsSubmitting(true); setError(null); setSuccessMessage(null);

        // Basic validation
        if (!title.trim() || !linkURL.trim()) {
             setError("Title and Resource Link (URL) are required.");
             setIsSubmitting(false); return;
        }
        // URL format check
        try { new URL(linkURL.trim()); } catch (_) { setError("Invalid Resource Link URL format."); setIsSubmitting(false); return; }

        const tags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);

        // Build payload with ONLY changed fields
        const payload: Partial<Resource> = {}; // Use Partial<Resource>
        if (title.trim() !== initialResourceData.title) payload.title = title.trim();
        if ((description.trim() || undefined) !== (initialResourceData.description || undefined)) payload.description = description.trim(); // Handle empty string vs undefined
        if (linkURL.trim() !== initialResourceData.linkURL) payload.linkURL = linkURL.trim();
        if (resourceType !== initialResourceData.resourceType) payload.resourceType = resourceType;
        if ((branch.trim() || undefined) !== (initialResourceData.branch || undefined)) payload.branch = branch.trim();
        if ((year.trim() || undefined) !== (initialResourceData.year || undefined)) payload.year = year.trim();
        if ((college.trim() || undefined) !== (initialResourceData.college || undefined)) payload.college = college.trim();
        if ((subject.trim() || undefined) !== (initialResourceData.subject || undefined)) payload.subject = subject.trim();
        if (JSON.stringify(tags) !== JSON.stringify(initialResourceData.tags || [])) payload.tags = tags;
        if (commentsEnabled !== (initialResourceData.commentsEnabled !== false)) payload.commentsEnabled = commentsEnabled;

        // If no changes, show message and return
        if (Object.keys(payload).length === 0) {
            setSuccessMessage("No changes detected.");
            setIsSubmitting(false); return;
        }

        try {
            const idToken = await getIdToken(user, true); // Force refresh token
            console.log("🔄 Sending PATCH request for resource:", payload);

            // *** Use resource PATCH API endpoint ***
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Update failed (${response.status})`);
            }

            const result = await response.json(); // Expect { message: ..., resource: ... }
            console.log("✅ Resource update successful:", result);
            setSuccessMessage("Resource updated successfully! Redirecting...");

            // Optimistically update local initial data state *before* redirect
            // This helps if there's a delay or issue with the redirect itself
            setInitialResourceData(prevData => prevData ? { ...prevData, ...payload } : null);

             // Redirect back to the resource view page
             const destinationUrl = `/resources/${resourceId}`;
             console.log(`🚀 Attempting redirect via router.push to: ${destinationUrl}`);
             // Use timeout to allow success message to be seen briefly
             setTimeout(() => {
                if (router) router.push(destinationUrl);
                else console.error("Router instance missing for redirect.");
            }, 1000); // 1 second delay

             // Keep submitting true during timeout to prevent further edits
             // setIsSubmitting(false); // Don't set false here

        } catch (err: any) {
            console.error("❌ Failed to submit resource update:", err);
            setError(err.message || "An unknown error occurred during update.");
            setSuccessMessage(null);
            setIsSubmitting(false); // Allow retry on error
        }
    };


     // --- Handlers for Deletion --- (Adapted for resources)
    const requestDeleteResource = () => {
        if (!isOwner) return;
        setDeleteError(null);
        setShowDeleteModal(true);
    };

    const confirmDeleteResource = async () => {
        if (!isOwner || !user || !resourceId) {
            setDeleteError("Cannot delete: Not authorized or resource ID missing.");
            return;
        }
        setIsDeleting(true);
        setDeleteError(null);
        try {
            const idToken = await getIdToken(user, true);
            // *** Use resource DELETE API endpoint ***
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to delete resource (${response.status})`);
            }
            console.log("Resource deleted successfully.");
            setShowDeleteModal(false);
            router.push('/resources'); // Redirect to resources list after deletion
        } catch (err: any) {
            console.error("❌ Failed to delete resource:", err);
            setDeleteError(err.message || "An unknown error occurred during deletion.");
        } finally {
            setIsDeleting(false);
        }
    };

    // --- Define shared input styles --- (Copied)
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200 text-gray-900";
    const selectStyle = "w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200 text-gray-900";
    const checkboxStyle = "focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded";


    // --- Render Logic ---
    // Initial loading or auth check pending
    if (isLoadingData || !authChecked) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Loading resource data...</div>; }
    // Error occurred during fetch or permission denied
    if (error && !isSubmitting) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">{error}</p> <Link href="/resources" className="text-blue-600 hover:underline">Back to Resources</Link> </div> ); }
    // Data fetched but user is not the owner
    if (!isOwner && !isLoadingData) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">Permission Denied: You cannot edit this resource.</p> <Link href={`/resources/${resourceId}`} className="text-blue-600 hover:underline">View Resource</Link> </div> ); }
    // Fallback if data is still null after loading (shouldn't normally happen if no error)
    if (!initialResourceData) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Resource data could not be loaded.</div>; }

    // --- Render Edit Form ---
    return (
        // Use similar page structure and styling
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-3 flex-wrap gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                    Edit Resource: <span className="font-normal text-gray-600">{initialResourceData.title}</span>
                </h1>
                <Link href={`/resources/${resourceId}`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                    Cancel & View Resource
                 </Link>
            </div>

            {/* Form Container */}
             <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 p-6 sm:p-8 bg-white rounded-lg shadow-md">
                {/* Title */}
                <div> <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Resource Title <span className="text-red-600">*</span></label> <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputStyle} /> </div>
                 {/* Link URL */}
                <div> <label htmlFor="linkURL" className="block text-sm font-medium text-gray-700 mb-1">Resource Link (URL) <span className="text-red-600">*</span></label> <input type="url" id="linkURL" value={linkURL} onChange={(e) => setLinkURL(e.target.value)} required className={inputStyle} placeholder="https://..." /> </div>
                 {/* Description */}
                <div> <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label> <textarea id="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className={inputStyle} /> </div>
                 {/* Resource Type */}
                 <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4"> <label htmlFor="resourceType" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-0 flex-shrink-0">Resource Type <span className="text-red-600">*</span></label> <select id="resourceType" value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType)} required className={selectStyle}> {resourceTypeOptions.map(type => ( <option key={type} value={type}>{type}</option> ))} </select> </div>

                 {/* Categorization Fields */}
                 <hr className="my-4 border-gray-200"/>
                 <h2 className="text-lg font-semibold text-gray-700 mb-3 -mt-1">Categorization (Optional)</h2>
                 <div> <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">Branch / Department</label> <input type="text" id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={inputStyle} placeholder="e.g., Computer Science"/> </div>
                 <div> <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label> <input type="text" id="year" value={year} onChange={(e) => setYear(e.target.value)} className={inputStyle} placeholder="e.g., 2nd Year"/> </div>
                 <div> <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-1">College / University</label> <input type="text" id="college" value={college} onChange={(e) => setCollege(e.target.value)} className={inputStyle} placeholder="e.g., State University"/> </div>
                 <div> <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject / Course Code</label> <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputStyle} placeholder="e.g., CS 101"/> </div>
                 {/* Tags */}
                 <div> <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">Tags</label> <input type="text" id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputStyle} placeholder="Comma-separated keywords..." /> <p className="text-xs text-gray-500 mt-1">Separate tags with commas.</p> </div>

                {/* Comments Enabled Toggle */}
                <div className="flex items-start pt-4 border-t border-gray-200 mt-6">
                    <div className="flex items-center h-5">
                        <input id="commentsEnabled" type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} className={checkboxStyle} />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="commentsEnabled" className="font-medium text-gray-700">Enable Chat/Comments</label>
                        <p className="text-xs text-gray-500">Allow users to post comments on this resource page.</p>
                    </div>
                </div>

                {/* Feedback Area */}
                <div className='min-h-[40px] pt-2'>
                    {error && !successMessage && ( <p className="text-sm text-red-600 p-2 bg-red-50 border border-red-200 rounded">Error: {error}</p> )}
                    {successMessage && ( <p className="text-sm text-green-600 p-2 bg-green-50 border border-green-200 rounded">{successMessage}</p> )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button type="submit" disabled={isSubmitting || !isOwner || !!successMessage} className="order-1 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    {/* Cancel Button */}
                    <Link href={`/resources/${resourceId}`} legacyBehavior>
                        <a className="order-2 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"> Cancel </a>
                    </Link>
                     {/* Delete Button */}
                     <button type="button" onClick={requestDeleteResource} disabled={isDeleting || !isOwner || isSubmitting} className="order-3 sm:ml-auto w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"> Delete Resource </button>
                </div>
            </form>

             {/* Delete Confirmation Modal */}
             {showDeleteModal && (
                 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
                     <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                         <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
                         <p className="text-sm text-gray-600 mb-1"> Delete resource: <span className="font-medium">{initialResourceData?.title}</span>? </p>
                         <p className="text-sm text-red-600 mb-4">This action cannot be undone.</p>
                         {deleteError && ( <p className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded-md mb-4">Error: {deleteError}</p> )}
                         <div className="flex justify-end gap-3 mt-6">
                             <button type="button" onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"> Cancel </button>
                             <button type="button" onClick={confirmDeleteResource} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center min-w-[120px]">
                                {isDeleting ? (
                                     <> <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg> Deleting... </>
                                 ) : 'Delete Resource'}
                            </button>
                         </div>
                     </div>
                 </div>
             )}

        </div> // Close main container
    );
}