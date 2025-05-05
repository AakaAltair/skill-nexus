// app/projects/[projectId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Project, ProjectUpdate, Comment } from '@/lib/types/project'; // Keep all types needed
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase';

// --- Import Child Components ---
import ClassroomBanner from '@/components/ClassroomBanner';
import AnnouncementsStream from '@/components/AnnouncementsStream';
import ProjectChatSidebar from '@/components/ProjectChatSidebar'; // Import the sidebar

// --- Main Single Project Page Component ---
export default function SingleProjectPage() {
    const params = useParams();
    const router = useRouter();
    const auth = getAuth(app);
    const projectId = typeof params?.projectId === 'string' ? params.projectId : undefined;

    // --- State ---
    const [project, setProject] = useState<Project | null>(null);
    const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
    // REMOVED state for comments fetched by this page
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
        return !!user && !!project && user.uid === project.creatorId;
    }, [user, project]);

    // --- Effect: Auth Listener ---
     useEffect(() => {
        setIsLoading(true); // Start loading on auth check
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true);
            // No need to set loading false here, let the data fetch effect handle it
        });
        return () => unsubscribe();
     }, [auth]);

    // --- Effect: Fetch Project Data & Updates (No longer fetches comments here) ---
    useEffect(() => {
        // If no project ID or auth hasn't been checked yet, don't proceed
        if (!projectId || !authChecked) {
             // Set error only if auth is checked but projectId is missing
             if (!projectId && authChecked) { setError("Invalid Project ID."); setIsLoading(false); }
             return;
        }

        let isMounted = true;
        setIsLoading(true);
        setError(null);
        setProject(null); // Reset project state before fetching
        setUpdates([]); // Reset updates state

        async function loadPageData() {
            console.log(`Fetching project & updates for page: ${projectId}`);
            try {
                // Fetch project details and updates concurrently
                const [projectRes, updatesRes] = await Promise.all([
                    fetch(`/api/projects/${projectId}`),
                    fetch(`/api/projects/${projectId}/updates`),
                    // REMOVED fetch for /comments here
                ]);

                 if (!isMounted) return; // Check if component is still mounted

                 // Process Project
                 if (projectRes.status === 404) throw new Error("Project not found.");
                 if (!projectRes.ok) {
                     const errText = await projectRes.text(); // Get raw text for better debugging
                     const err = JSON.parse(errText || '{}').catch(() => ({ error: errText }));
                     throw new Error(err.error || `Failed project fetch (${projectRes.status})`);
                 }
                 const projectData = await projectRes.json();
                 if (!projectData.project) throw new Error("Invalid project data format.");
                 if (isMounted) setProject(projectData.project);

                 // Process Updates
                 if (updatesRes.ok) {
                     const d = await updatesRes.json();
                     if (d.updates && Array.isArray(d.updates)) {
                         if (isMounted) setUpdates(d.updates);
                     } else {
                         console.warn("Invalid updates format.");
                     }
                 } else {
                     // Don't throw error for failed updates, just log it
                     console.error(`Updates fetch failed (${updatesRes.status})`);
                 }

            } catch (err: any) {
                 console.error("Error loading page data:", err);
                 if (isMounted) setError(err.message || "An error occurred while loading project data.");
            } finally {
                 // Set loading to false regardless of success or error
                 if (isMounted) setIsLoading(false);
            }
        }

        loadPageData();

        // Cleanup function
        return () => {
            isMounted = false;
        };
    }, [projectId, authChecked]); // Dependencies: fetch when projectId or auth state changes


    // --- Delete Action Handlers ---
    const requestDeleteProject = useCallback(() => {
        if (!isOwner) return;
        setShowDeleteModal(true);
    }, [isOwner]);

    const confirmDeleteProject = useCallback(async () => {
        if (!isOwner || !user || !project) return;

        setIsDeleting(true);
        setDeleteError(null);

        try {
            const idToken = await getIdToken(user, true);
            const response = await fetch(`/api/projects/${project.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to delete (${response.status})`);
            }

            console.log("Project deleted successfully");
            setShowDeleteModal(false);
            // Redirect to the projects list page after successful deletion
            router.push('/projects'); // Or router.back() if preferred

        } catch (err: any) {
            console.error("❌ Delete project error:", err);
            setDeleteError(err.message || "Could not delete project.");
        } finally {
            setIsDeleting(false);
        }
    }, [isOwner, user, project, router]); // Added project and router to dependencies

    // --- Back Button Handler ---
     const handleBackClick = () => {
         router.back(); // Simple browser back
     };

     // --- Toggle Chat Sidebar ---
     const toggleChat = () => {
        // console.log("Toggling chat sidebar state to:", !isChatOpen); // Keep for debugging if needed
        setIsChatOpen(prev => !prev);
     };

    // --- Render Loading/Error/Fallback ---
    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen">Loading project...</div>; // Basic loading UI
    }

    if (error && !project) {
        // Show error prominently if project couldn't load at all
        return <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
                 <h2 className="text-xl font-semibold text-red-600 mb-4">Error Loading Project</h2>
                 <p className="text-gray-600 mb-6">{error}</p>
                 <button onClick={handleBackClick} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                     Go Back
                 </button>
               </div>;
    }

    if (!project) {
        // Fallback if not loading and no error, but project is still null (shouldn't happen often)
        return <div className="flex justify-center items-center min-h-screen">Project data not available.</div>;
    }

    // --- Render Project Details Page ---
    return (
        <div className="bg-gray-50 min-h-screen relative pb-20"> {/* Added padding-bottom */} 

             {/* --- Page Content Container - Adjusted Padding Logic --- */}
             <div className={`container mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20 md:pt-24 transition-padding duration-300 ease-in-out ${
                 // Use padding-right on large screens ONLY when chat is open
                 // Adjust padding to account for 40% width sidebar + gap
                 isChatOpen ? 'lg:pr-[calc(40%_+_1rem)]' : ''
                }`}
            >
                {/* Back Button */}
                <div className="mb-6 print:hidden">
                    <button onClick={handleBackClick} className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors duration-150 group">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1.5 text-gray-400 group-hover:text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                        Back
                    </button>
                </div>

                {/* Render Classroom Banner */}
                <ClassroomBanner
                    project={project} // Project is guaranteed to be non-null here
                    isOwner={isOwner}
                    onDeleteRequest={requestDeleteProject}
                 />

                {/* Main Content Area (Stream) */}
                <div className="mt-8 md:mt-10">
                    {/* --- AnnouncementsStream --- */}
                    <AnnouncementsStream
                        projectId={projectId!} // Use non-null assertion as projectId is checked
                        isOwner={isOwner}
                        initialUpdates={updates}
                        currentUser={user}
                    />
                </div>
             </div>
             {/* --- End Page Content Container --- */}


             {/* --- Render Chat Sidebar (Conditionally) --- */}
             {/* Render outside the padded container for fixed positioning */}
             {/* projectId is guaranteed by checks above, project is also checked */} 
             <ProjectChatSidebar
                 projectId={projectId!}
                 projectTitle={project.title}
                 currentUser={user}
                 commentsEnabled={project.commentsEnabled !== false} // Default to true if undefined
                 isOpen={isChatOpen}
                 onClose={toggleChat}
             />
             {/* --- End Chat Sidebar --- */}


             {/* --- Chat Toggle Button (Floating) --- */}
             {/* Render only if comments are enabled */}
             {project.commentsEnabled !== false && (
                <button
                    onClick={toggleChat}
                    className={`fixed top-24 right-6 z-30 p-4 rounded-full text-white shadow-lg transition-all duration-300 ease-in-out transform hover:scale-110 ${ isChatOpen ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    title={isChatOpen ? "Close Chat" : "Open Project Chat"}
                    aria-label={isChatOpen ? "Close project chat sidebar" : "Open project chat sidebar"}
                >
                    {isChatOpen ? (
                        /* Close Icon (X) - Larger */
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                     ) : (
                        /* New Brainstorming/Chat Icon - Larger */
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                            <path d="M11.5 7.5c-.28 0-.5.22-.5.5v3.57c0 .36.18.7.46.9l2.18 1.63c.22.17.52.14.71-.08.19-.22.16-.53-.06-.71l-1.94-1.45V8c0-.28-.22-.5-.5-.5z"/>
                            <path d="M12 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-3c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                            <path d="M12 13c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4zm6 4H6v-.57c.02-.58.85-1.17 3.01-1.72C10.47 14.11 11.21 14 12 14s1.53.11 2.99.71c2.16.55 2.99 1.14 3.01 1.72V17z"/>
                        </svg>
                    )}
                </button>
             )}
             {/* --- End Chat Toggle Button --- */}


             {/* --- Delete Confirmation Modal --- */}
             {showDeleteModal && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-semibold mb-3">Confirm Deletion</h3>
                        <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete the project "{project.title}"? This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                            <button onClick={confirmDeleteProject} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-wait flex items-center">
                                {isDeleting ? (
                                    <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V..." className="opacity-75" fill="currentColor"></path></svg> Deleting...</>
                                ) : 'Delete Project'}
                             </button>
                        </div>
                         {deleteError && <p className="text-xs text-red-600 mt-3 text-center">Error: {deleteError}</p>}
                    </div>
                </div>
             )}
        </div>
    );
}