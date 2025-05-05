// app/placements/achievements/[achievementId]/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StudentAchievement } from '@/lib/types/placement'; // Adjust path if needed
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase'; // Adjust path if needed
import { formatTimestamp, formatSimpleDate } from '@/lib/dateUtils'; // Adjust path if needed
// Import Icons needed for display and buttons
import { Building2, Briefcase, Award, GraduationCap, MapPin, IndianRupee, Code2, MessageSquare, CalendarDays, Pencil, Trash2 } from 'lucide-react';
// Import Modal if using one for delete confirmation
import Modal from '@/components/Modal'; // Adjust path if needed


export default function AchievementDetailPage() {
    const params = useParams();
    const router = useRouter();
    const auth = getAuth(app);
    // Ensure achievementId is treated as string | undefined
    const achievementId = typeof params?.achievementId === 'string' ? params.achievementId : undefined;

    // --- State ---
    const [achievement, setAchievement] = useState<StudentAchievement | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    // State for delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);


    // --- Derived State: Check Ownership ---
    // Check if the current user is the one who CREATED the post
    const isOwner = useMemo(() => {
        return !!user && !!achievement && user.uid === achievement.creatorId; // Check against creatorId
    }, [user, achievement]);

    // --- Auth Listener ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true);
        });
        return () => unsubscribe();
    }, [auth]);

    // --- Fetch Achievement Data ---
    useEffect(() => {
        if (!achievementId || !authChecked) {
            if (!achievementId && authChecked) { setError("Invalid Achievement ID."); setIsLoading(false); }
            return;
        }
        let isMounted = true;
        setIsLoading(true); setError(null); setAchievement(null);

        async function loadAchievement() {
            console.log(`Fetching achievement details: ${achievementId}`);
            try {
                const response = await fetch(`/api/placement/achievements/${achievementId}`);
                if (!isMounted) return;
                if (response.status === 404) throw new Error("Achievement post not found.");
                if (!response.ok) {
                    let errorDetails = `API Error: ${response.status}`;
                    try { const d = await response.json(); errorDetails = d.error || d.details || errorDetails; } catch {}
                    throw new Error(errorDetails);
                 }
                const data = await response.json();
                if (!data.achievement) throw new Error("Invalid data format.");
                if (isMounted) setAchievement(data.achievement);
            } catch (err: any) { if (isMounted) setError(err.message || "Could not load achievement details."); console.error("Fetch Error:", err); }
            finally { if (isMounted) setIsLoading(false); }
        }
        loadAchievement();
        return () => { isMounted = false; };
    }, [achievementId, authChecked]);


    // --- Delete Handlers ---
    const requestDelete = useCallback(() => {
        if (!isOwner) return; // Only owner can initiate delete
        setDeleteError(null);
        setShowDeleteModal(true);
    }, [isOwner]);

    const confirmDelete = useCallback(async () => {
        if (!isOwner || !user || !achievement?.id) return; // Ensure achievement exists
        setIsDeleting(true); setDeleteError(null);
        try {
            const idToken = await getIdToken(user, true);
            // Call the DELETE API for this specific achievement
            const response = await fetch(`/api/placement/achievements/${achievement.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || `Delete failed (${response.status})`); }
            console.log("Achievement deleted successfully");
            setShowDeleteModal(false);
            router.push('/placements'); // Redirect back to placements hub after delete
        } catch (err: any) { setDeleteError(err.message || "Could not delete post."); console.error("Delete Error:", err); }
        finally { setIsDeleting(false); }
    }, [isOwner, user, achievement, router]); // Added achievement and router


    // --- Render States ---
    if (isLoading || !authChecked) {
         return ( <div className="flex justify-center items-center min-h-screen text-gray-500">Loading...</div> );
    }
    if (error) {
         return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">{error}</p> <Link href="/placements" className="text-blue-600 hover:underline">Back to Placements Hub</Link> </div> );
     }
     if (!achievement) {
         return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500"> Achievement post not found. <Link href="/placements" className="block mt-4 text-blue-600 hover:underline">Back to Placements Hub</Link> </div> );
     }

    // --- Render Detail View ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
            {/* Back Button */}
            <div className="mb-6">
                <Link href="/placements" className="inline-flex items-center text-sm text-blue-600 hover:underline">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 mr-1"><path fillRule="evenodd" d="M11.78 4.22a.75.75 0 0 1 0 1.06L8.06 9l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
                    Back to Placements Hub
                </Link>
            </div>

            {/* Main Content Card */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md border border-gray-200/80 relative">

                {/* --- Edit/Delete Buttons for Owner (Top Right) --- */}
                {isOwner && ( // Show only if the logged-in user created this post
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {/* Link to the Edit Page */}
                        <Link href={`/placements/achievements/${achievement.id}/edit`} legacyBehavior>
                            <a className="p-1.5 rounded hover:bg-yellow-100 text-yellow-600 transition-colors" title="Edit Post">
                                <Pencil size={18} strokeWidth={2.5} />
                            </a>
                        </Link>
                        {/* Button to trigger Delete Modal */}
                        <button onClick={requestDelete} className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors" title="Delete Post" disabled={isDeleting}>
                            <Trash2 size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                )}

                {/* Header Section: Placed Student Name, Branch/Year, Post Date */}
                <div className='pb-4 mb-4 border-b border-gray-100'>
                     {/* Display Placed Student's Name */}
                     <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">{achievement.placedStudentName}</h1>
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {/* Display Placed Student's Branch/Year */}
                        {(achievement.placedStudentBranch || achievement.placedStudentYear) && (
                            <span className='inline-flex items-center gap-1'>
                                <GraduationCap size={14}/>
                                {achievement.placedStudentBranch}{achievement.placedStudentBranch && achievement.placedStudentYear ? ' • ' : ''}{achievement.placedStudentYear}
                            </span>
                         )}
                         {/* Display Post Creation Date */}
                        <span className='inline-flex items-center gap-1' title={`Posted on: ${formatSimpleDate(achievement.createdAt)}`}>
                            <CalendarDays size={14}/>
                            Posted {formatTimestamp(achievement.createdAt)}
                        </span>
                     </div>
                </div>

                {/* Placement Details Section */}
                <div className="mb-5 space-y-2 text-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Placement Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {/* Using definition list style for clarity */}
                        <div className="flex items-start gap-2"><Building2 size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/> <div><strong className='text-gray-600 block text-xs'>Company:</strong> {achievement.companyName}</div></div>
                        {achievement.roleTitle && <div className="flex items-start gap-2"><Briefcase size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/> <div><strong className='text-gray-600 block text-xs'>Role:</strong> {achievement.roleTitle}</div></div>}
                        {achievement.placementType && <div className="flex items-start gap-2"><Award size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/> <div><strong className='text-gray-600 block text-xs'>Type:</strong> {achievement.placementType}</div></div>}
                        {achievement.location && <div className="flex items-start gap-2"><MapPin size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/> <div><strong className='text-gray-600 block text-xs'>Location:</strong> {achievement.location}</div></div>}
                        {achievement.salary && <div className="flex items-start gap-2"><IndianRupee size={16} className="text-gray-400 flex-shrink-0 mt-0.5"/> <div><strong className='text-gray-600 block text-xs'>Package:</strong> {achievement.salary}</div></div>}
                    </div>
                </div>

                 {/* Skills Section */}
                 {achievement.skills && achievement.skills.length > 0 && (
                     <div className="mb-5">
                        <h3 className='text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2'>Skills</h3>
                        <div className='flex flex-wrap gap-1.5'>
                            {achievement.skills.map(s => <span key={s} className='text-xs bg-blue-100 text-blue-800 border border-blue-200 rounded px-2 py-0.5 font-medium'>{s}</span>)}
                        </div>
                    </div>
                 )}

                 {/* Job Description Section */}
                {achievement.jobDescription && (
                    <div className='mb-5 pt-4 border-t border-gray-100'>
                        <h3 className='text-sm font-semibold text-gray-700 mb-1'>Role Description</h3>
                        <p className='text-sm whitespace-pre-wrap text-gray-600'>{achievement.jobDescription}</p>
                    </div>
                )}

                {/* Main Text/Experience Section */}
                {achievement.text && (
                    <div className='mb-5 pt-4 border-t border-gray-100'>
                        <h3 className='text-sm font-semibold text-gray-700 mb-1'>Experience / Advice</h3>
                        <p className='text-sm whitespace-pre-wrap text-gray-600'>{achievement.text}</p>
                    </div>
                )}

                 {/* Personal Message Section */}
                {achievement.personalMessage && (
                    <div className='mb-1 pt-4 border-t border-gray-100'>
                        <h3 className='text-sm font-semibold text-gray-700 mb-1'>Personal Note</h3>
                        <p className='text-sm italic text-gray-600'>"{achievement.personalMessage}"</p>
                    </div>
                )}

                 {/* Posted By Information */}
                  <div className="mt-6 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      Posted by: {achievement.creatorName}
                      {achievement.updatedAt && achievement.createdAt !== achievement.updatedAt && (
                          <span className='ml-2 italic'>(Edited {formatTimestamp(achievement.updatedAt)})</span>
                      )}
                  </div>

            </div> {/* End Main Content Card */}

            {/* --- Delete Confirmation Modal --- */}
             {showDeleteModal && (
                 // Using the generic Modal component
                 <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Deletion">
                     <div className="space-y-4">
                         <p className="text-sm text-gray-600">Are you sure you want to delete this achievement post? This action cannot be undone.</p>
                         {/* Display deletion error message inside modal */}
                         {deleteError && (
                             <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">Error: {deleteError}</p>
                         )}
                         {/* Modal Action Buttons */}
                         <div className="flex justify-end gap-3 pt-3">
                            <button
                                type="button"
                                onClick={() => { setShowDeleteModal(false); setDeleteError(null); }} // Close modal and clear error
                                disabled={isDeleting}
                                className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"
                            >
                                Cancel
                             </button>
                             <button
                                type="button"
                                onClick={confirmDelete} // Call the delete confirmation handler
                                disabled={isDeleting}
                                className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center min-w-[90px]" // Min width for loading state
                            >
                                {isDeleting ? (
                                     // Loading Spinner
                                     <> <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg> Deleting... </>
                                 ) : 'Delete Post'}
                             </button>
                         </div>
                     </div>
                 </Modal>
             )}
             {/* --- End Delete Modal --- */}

        </div> // End Page Container
    );
}