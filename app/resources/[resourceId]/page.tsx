// app/resources/[resourceId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Resource, ResourceUpdate } from '@/lib/types/resource'; // Import Resource types
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase';

// --- Import Child Components ---
// Make sure these paths are correct for your project structure
import ResourceBanner from '@/components/ResourceBanner';
import ResourceAnnouncementsStream from '@/components/ResourceAnnouncementsStream';
import ResourceChatSidebar from '@/components/ResourceChatSidebar';

// --- Main Single Resource Page Component ---
export default function SingleResourcePage() {
    const params = useParams();
    const router = useRouter();
    const auth = getAuth(app);
    // Ensure resourceId is treated as string | undefined
    const resourceId = typeof params?.resourceId === 'string' ? params.resourceId : undefined;

    // --- State ---
    const [resource, setResource] = useState<Resource | null>(null);
    const [updates, setUpdates] = useState<ResourceUpdate[]>([]); // State for resource updates
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // --- Sidebar State ---
    const [isChatOpen, setIsChatOpen] = useState(false);

    // --- Derived State for Ownership ---
    const isOwner = useMemo(() => {
        // Check if user is logged in and resource data exists and IDs match
        return !!user && !!resource && user.uid === resource.uploaderId;
    }, [user, resource]);

    // --- Effect: Auth Listener ---
     useEffect(() => {
        // Don't set loading true here initially, let data fetch handle it
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true); // Mark auth as checked once listener fires
        });
        // Cleanup listener on component unmount
        return () => unsubscribe();
     }, [auth]); // Dependency array includes auth

    // --- Effect: Fetch Resource Data & Updates ---
    useEffect(() => {
        // Wait for valid resourceId AND auth check completion
        if (!resourceId || !authChecked) {
             // If auth is checked but resourceId is missing, set error
             if (!resourceId && authChecked) {
                setError("Invalid Resource ID provided in URL.");
                setIsLoading(false); // Stop loading as we can't fetch
             }
             // If auth is not checked yet, just return and wait
             return;
        }

        let isMounted = true;
        setIsLoading(true); // Start loading when ready to fetch
        setError(null);
        setResource(null); // Reset states before fetching
        setUpdates([]);

        async function loadPageData() {
            console.log(`Fetching resource & updates for page: ${resourceId}`);
            try {
                // Fetch resource details and updates concurrently
                const [resourceRes, updatesRes] = await Promise.all([
                    fetch(`/api/resources/${resourceId}`),
                    fetch(`/api/resources/${resourceId}/updates`), // Fetch updates
                ]);

                 if (!isMounted) return; // Exit if component unmounted during fetch

                 // Process Resource Response
                 if (resourceRes.status === 404) {
                    throw new Error("Resource not found.");
                 }
                 if (!resourceRes.ok) {
                     // Try to parse error json, fallback to status text
                     const errData = await resourceRes.json().catch(() => ({ error: `API Error ${resourceRes.status}` }));
                     throw new Error(errData.error || `Failed to fetch resource details (${resourceRes.status})`);
                 }
                 const resourceData = await resourceRes.json();
                 // Expecting { resource: ... } based on API implementation
                 if (!resourceData.resource) {
                    throw new Error("Invalid resource data format received from API.");
                 }
                 if (isMounted) {
                    setResource(resourceData.resource);
                 }

                 // Process Updates Response
                 if (updatesRes.ok) {
                     const updatesData = await updatesRes.json();
                     // Expecting { updates: [...] } based on API implementation
                     if (updatesData.updates && Array.isArray(updatesData.updates)) {
                         if (isMounted) {
                            setUpdates(updatesData.updates);
                         }
                         console.log(`Fetched ${updatesData.updates.length} updates.`);
                     } else {
                         console.warn("Invalid updates data format received from API.");
                         if (isMounted) setUpdates([]); // Set empty if format is wrong
                     }
                 } else {
                     // Don't fail the whole page for failed updates, just log
                     console.error(`Resource updates fetch failed (${updatesRes.status})`);
                      if (isMounted) setUpdates([]); // Set empty on fetch failure
                 }

            } catch (err: any) {
                 console.error("Error loading resource page data:", err);
                 if (isMounted) {
                    setError(err.message || "An error occurred while loading resource data.");
                    // Clear data on error
                    setResource(null);
                    setUpdates([]);
                 }
            } finally {
                 // Stop loading indicator regardless of success or error
                 if (isMounted) {
                    setIsLoading(false);
                 }
            }
        }

        loadPageData();

        // Cleanup function to prevent state updates on unmounted component
        return () => {
            isMounted = false;
        };

    }, [resourceId, authChecked]); // Re-fetch if ID or auth state changes


    // --- Delete Action Handlers ---
    const requestDeleteResource = useCallback(() => {
        if (!isOwner) return; // Shouldn't be callable if not owner, but safety check
        setShowDeleteModal(true);
        setDeleteError(null); // Clear previous delete errors
    }, [isOwner]);

    const confirmDeleteResource = useCallback(async () => {
        // Ensure all necessary data is available
        if (!isOwner || !user || !resource?.id) {
            setDeleteError("Cannot delete resource: Missing information or permissions.");
            return;
        }

        setIsDeleting(true);
        setDeleteError(null);

        try {
            const idToken = await getIdToken(user, true); // Force refresh token if needed
            // Use the correct DELETE endpoint for resources
            const response = await fetch(`/api/resources/${resource.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({})); // Attempt to parse error body
                throw new Error(errData.error || `Failed to delete resource (${response.status})`);
            }

            console.log("Resource deleted successfully via API");
            setShowDeleteModal(false); // Close modal on success
            // Redirect to the resources list page
            router.push('/resources');

        } catch (err: any) {
            console.error("❌ Delete resource error:", err);
            setDeleteError(err.message || "Could not delete resource. Please try again.");
            // Keep modal open to show error
        } finally {
            setIsDeleting(false); // Stop loading indicator
        }
    }, [isOwner, user, resource, router]); // Depend on resource object for ID and title

    // --- Back Button Handler ---
     const handleBackClick = () => {
         router.push('/resources'); // Navigate consistently to the list page
     };

     // --- Toggle Chat Sidebar ---
     const toggleChat = () => {
        setIsChatOpen(prev => !prev);
     };

    // --- Render Loading State ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path>
                </svg>
            </div>
        );
    }

    // --- Render Error State (if resource fetch failed) ---
    if (error && !resource) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
                <h2 className="text-xl font-semibold text-red-600 mb-4">Error Loading Resource</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button onClick={handleBackClick} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    Go Back to Resources
                </button>
            </div>
        );
    }

    // --- Render Fallback (if somehow not loading, no error, but no resource) ---
    if (!resource) {
        // This case might indicate an issue with the API returning empty data unexpectedly
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
                 <h2 className="text-xl font-semibold text-gray-700 mb-4">Resource Not Found</h2>
                 <p className="text-gray-500 mb-6">The requested resource could not be loaded.</p>
                 <button onClick={handleBackClick} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                     Go Back to Resources
                 </button>
            </div>
        );
    }

    // --- Render Resource Details Page ---
    return (
        <div className="bg-gray-50 min-h-screen relative pb-20">

             {/* Content Container */}
             <div className={`container mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20 md:pt-24 transition-padding duration-300 ease-in-out ${
                 isChatOpen ? 'lg:pr-[calc(40%_+_1rem)]' : '' // Adjust right padding when chat is open on large screens
                }`}
            >
                {/* Back Button */}
                <div className="mb-6 print:hidden">
                    <button onClick={handleBackClick} className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors duration-150 group">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5 text-gray-400 group-hover:text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                        Back to Resources
                    </button>
                </div>

                {/* Render Resource Banner */}
                <ResourceBanner
                    resource={resource} // Pass the fetched resource
                    isOwner={isOwner}
                    onDeleteRequest={requestDeleteResource} // Pass the delete trigger function
                 />

                {/* Main Content Area (Announcements Stream) */}
                <div className="mt-8 md:mt-10">
                    {/* Render Resource Announcements Stream */}
                    <ResourceAnnouncementsStream
                        resourceId={resourceId!} // resourceId is guaranteed non-null here
                        isOwner={isOwner}
                        initialUpdates={updates} // Pass the fetched updates
                        currentUser={user}
                    />
                </div>
             </div>

             {/* Render Chat Sidebar (Conditionally based on isOpen) */}
             {/* Render outside the padded container for fixed positioning */}
             <ResourceChatSidebar
                 resourceId={resourceId!} // resourceId is guaranteed non-null here
                 resourceTitle={resource.title} // Pass resource title for context
                 currentUser={user}
                 // Use resource.commentsEnabled if added to type, otherwise default true
                 commentsEnabled={resource.commentsEnabled !== false}
                 isOpen={isChatOpen}
                 onClose={toggleChat} // Pass the toggle function to allow closing
             />

             {/* Chat Toggle Button (Floating) */}
             {/* Render toggle button only if comments are enabled on the resource */}
             {resource.commentsEnabled !== false && (
                <button
                    onClick={toggleChat}
                    className={`fixed top-24 right-6 z-30 p-3 rounded-full text-white shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110 ${
                        isChatOpen
                            ? 'bg-red-600 hover:bg-red-700' // Red for close
                            : 'bg-cyan-600 hover:bg-cyan-700' // Cyan for open (differentiates from project blue)
                        }`}
                    title={isChatOpen ? "Close Chat" : "Open Resource Chat"}
                    aria-label={isChatOpen ? "Close resource chat sidebar" : "Open resource chat sidebar"}
                >
                    {isChatOpen ? (
                        // Close Icon (X)
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                     ) : (
                        // Chat Icon
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" /></svg>
                    )}
                </button>
             )}

             {/* Delete Confirmation Modal */}
             {showDeleteModal && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-semibold mb-3 text-gray-900">Confirm Deletion</h3>
                        <p className="text-sm text-gray-600 mb-5">
                            Are you sure you want to delete the resource "{resource.title}"? This action cannot be undone.
                        </p>
                        {/* Display specific delete error here */}
                         {deleteError && <p className="text-xs text-red-600 mb-3">Error: {deleteError}</p>}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteResource}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center min-w-[100px]" // Added min-width
                            >
                                {isDeleting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                                            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path>
                                        </svg>
                                        Deleting...
                                    </>
                                ) : 'Delete Resource'}
                             </button>
                        </div>
                    </div>
                </div>
             )}
        </div>
    );
}