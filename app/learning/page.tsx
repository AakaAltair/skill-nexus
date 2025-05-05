// app/learning/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { LearningClassroom } from '@/lib/types/learning'; // Import the new type
import LearningClassroomCard from '@/components/LearningClassroomCard'; // Import the new card component
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext'; // Import the useAuth hook
import LoadingSpinner from '@/components/LoadingSpinner'; // Your loading spinner component
import ErrorMessage from '@/components/ErrorMessage'; // Your error message component

// Define a base min-height for containers to prevent content jumping
// Adjust based on your Navbar height and overall layout needs (Navbar H-16 = 4rem)
const MIN_HEIGHT_CONTENT = 'min-h-[calc(100vh-4rem-2rem)]'; // Full viewport height - Navbar height - top/bottom padding (e.g., py-8)


const LearningClassroomsPage: React.FC = () => {
    // --- State ---
    const [classrooms, setClassrooms] = useState<LearningClassroom[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Loading state for data fetch
    const [error, setError] = useState<string | null>(null);

    // --- Get User and Auth/Profile Loading State from Context ---
    // isAuthLoading: true initially, false when Firebase Auth state is known (logged in or out)
    // isProfileLoading: true after user is known, false after profile fetch attempt (we still need to wait for profile load to confirm user existence reliably sometimes)
    // userRole is used in JSX conditions, and its availability depends on isProfileLoading being false
    const { currentUser, userProfile, userRole, isAuthLoading, isProfileLoading } = useAuth();

    // Get the current user's UID to pass to cards for distinguishing membership
    const currentUserId = currentUser?.uid || null;

    // --- Fetch Classrooms Effect ---
    useEffect(() => {
        // Wait until BOTH initial Firebase Auth state AND the user profile (including role) are loaded.
        // We need currentUser to know if they are logged in.
        // We also need userRole (which becomes available after profile load) for sorting and potentially button logic elsewhere,
        // so waiting for isProfileLoading is appropriate before fetching data that depends on the *logged-in* user's identity/status.
        if (isAuthLoading || isProfileLoading) {
            setIsLoading(true); // Keep the main page loading spinner active while auth/profile loads
            console.log("Learning Page Effect: Waiting for auth/profile to load...");
            return; // Exit effect until dependencies are resolved
        }

        // If auth/profile load complete, and no user is logged in (currentUser is null)...
        if (!currentUser) {
             console.log("Learning Page Effect: Auth/Profile loaded, no user logged in. Clearing list.");
             setIsLoading(false); // Stop the main page loading spinner
             setClassrooms([]); // Ensure classrooms state is empty
             // The empty state message in the JSX will handle the rest
             return; // Stop the effect here
        }

        // If a user IS logged in and auth/profile loading is complete, fetch classrooms
        console.log(`Learning Page Effect: User (${currentUser.uid}, role: ${userRole}) loaded. Initiating classroom data fetch...`);
        const fetchClassrooms = async () => {
            setIsLoading(true); // Start loading state for data fetch
            setError(null); // Clear previous errors

            try {
                // Get the user's ID token for backend authentication
                const idToken = await currentUser.getIdToken(true);

                const headers: HeadersInit = {
                    'Authorization': `Bearer ${idToken}`, // Include auth token
                };

                // Fetch data from the backend API endpoint
                const response = await fetch('/api/learning-classrooms', { headers });

                if (!response.ok) {
                     // Attempt to parse error message from API response body
                    const errorBody = await response.json().catch(() => ({}));
                    const apiError = errorBody.message || `Failed to fetch classrooms (${response.status})`;
                    throw new Error(apiError);
                }

                const data = await response.json();

                if (data.classrooms && Array.isArray(data.classrooms)) {
                    console.log(`Learning Page Effect: Fetched ${data.classrooms.length} classrooms.`);
                    // Optional: Sort classrooms for consistent display
                    const sortedClassrooms = data.classrooms.sort((a, b) => {
                         // Example sort: User's teacher classes first, then user's student classes,
                         // then others (if any unexpected in list), then by academic year (desc), then name (asc)
                         const isCurrentUserTeacherA = a.teacherIds?.includes(currentUser.uid); // Use optional chaining
                         const isCurrentUserTeacherB = b.teacherIds?.includes(currentUser.uid); // Use optional chaining
                         const isCurrentUserStudentA = a.studentIds?.includes(currentUser.uid); // Use optional chaining
                         const isCurrentUserStudentB = b.studentIds?.includes(currentUser.uid); // Use optional chaining

                         // Priority 1: Current user is Teacher in A, but not B
                         if (isCurrentUserTeacherA && !isCurrentUserTeacherB) return -1;
                         if (!isCurrentUserTeacherA && isCurrentUserTeacherB) return 1;

                         // Priority 2: Current user is Student in A, but not B (only if not a teacher in either)
                         if (!isCurrentUserTeacherA && !isCurrentUserTeacherB) { // Only compare student status if not teacher in either
                             if (isCurrentUserStudentA && !isCurrentUserStudentB) return -1;
                             if (!isCurrentUserStudentA && isCurrentUserStudentB) return 1;
                         }

                         // Default sort: If same relationship status (or neither), sort by academic year and name
                         if (a.academicYear > b.academicYear) return -1;
                         if (a.academicYear < b.academicYear) return 1;
                         return a.name.localeCompare(b.name);
                    });
                    setClassrooms(sortedClassrooms);
                } else {
                    console.warn("Learning Page Effect: Received unexpected data format from API.", data);
                    setClassrooms([]); // Fallback to empty array
                }

            } catch (err: any) {
                console.error('❌ Learning Page Effect: Error fetching learning classrooms:', err);
                setError(err.message || 'Could not load classrooms.');
            } finally {
                setIsLoading(false); // Stop the data loading spinner
                console.log("Learning Page Effect: Data fetch complete.");
            }
        };

        fetchClassrooms();

    }, [currentUser, isAuthLoading, isProfileLoading, userRole]); // --- CORRECTED DEPENDENCY ARRAY ---
    // Include userRole in dependencies. Even if not directly used *in* the fetch call,
    // the effect *depends* on the completion of the profile load where userRole is determined.


    // --- Render ---
    return (
        // Main container with padding to offset fixed Navbar and base min-height
        // MIN_HEIGHT_CONTENT ensures the page takes up at least the remaining viewport space below navbar
        <div className={`container mx-auto px-4 py-8 sm:px-6 lg:px-8 mt-16 ${MIN_HEIGHT_CONTENT}`}>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Learning Classrooms</h1>

            {/* Action Buttons Area */}
            {/* Buttons container */}
            <div className="flex justify-end gap-4 mb-8">
                {/* Show skeleton buttons while auth/profile are loading */}
                {(isAuthLoading || isProfileLoading) && (
                     <>
                         {/* Skeleton for Create button */}
                         <div className="h-10 w-36 bg-gray-200 rounded-md animate-pulse"></div>
                         {/* Skeleton for Join button */}
                         <div className="h-10 w-36 bg-gray-200 rounded-md animate-pulse"></div>
                     </>
                )}
                {/* Render actual buttons once auth/profile loading is complete AND user is logged in */}
                {/* Simplified button logic: Show both if logged in */}
                {(!isAuthLoading && !isProfileLoading && currentUser) && (
                    <>
                        {/* Create Classroom Button (Show for ANY authenticated user) */}
                        <Link
                            href="/learning/create"
                            className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 text-sm font-medium"
                        >
                            Create Classroom
                        </Link>
                        {/* Join Classroom Button (For any logged-in user) */}
                         <Link
                            href="/learning/join" // Link to the join code page/modal
                            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-150 text-sm font-medium"
                         >
                            Join Classroom
                         </Link>
                    </>
                )}
                {/* If not logged in after auth/profile load, no buttons are shown here */}
            </div>

            {/* --- Content Area: Loading, Error, Empty State, or Classrooms Grid --- */}
            {isLoading ? (
                 // Show loading spinner if fetching classrooms data
                 <div className="flex justify-center py-8">
                    <LoadingSpinner />
                 </div>
             ) : error ? (
                 // Show error message if data fetching failed
                 <div className="py-8">
                     <ErrorMessage message={error} />
                 </div>
             ) : classrooms.length === 0 && (!isAuthLoading && !isProfileLoading) ? (
                 // Show empty state ONLY if data is not loading, no error, AND auth/profile are loaded
                 <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                     <p className="text-xl font-semibold text-gray-600 mb-3">No Learning Classrooms Found</p>
                     <p className="text-gray-500 mb-4">It looks like you haven't joined or created any classrooms yet.</p>
                      {/* Show actions based on whether user is logged in AFTER auth/profile load */}
                      {(!isAuthLoading && !isProfileLoading && currentUser) ? (
                          // If logged in, show both options in the empty state
                           <div className="flex flex-col items-center gap-2">
                                <Link href="/learning/create" className="text-blue-600 hover:underline font-medium">Create your first classroom</Link>
                                <span>or</span> {/* Optional separator for clarity */}
                                <Link href="/learning/join" className="text-blue-600 hover:underline font-medium">Join a classroom with a code</Link>
                           </div>
                      ) : (
                           // Not logged in after auth/profile load
                           <p className="text-sm text-gray-500">Please log in to view or join classrooms.</p>
                      )}
                 </div>
             ) : (
                // If not loading, no error, and classrooms exist, render the grid
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {classrooms.map(classroom => (
                        // Render each LearningClassroomCard
                        // Pass the classroom data AND the current user's UID
                        <LearningClassroomCard
                            key={classroom.id}
                            classroom={classroom}
                            currentUserId={currentUserId} // Pass the UID here for membership badge
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default LearningClassroomsPage;