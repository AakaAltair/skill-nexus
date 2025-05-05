// app/learning/[classroomId]/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
// Import types
import { LearningClassroom, UserProfile } from '@/lib/types/learning';
import { useAuth } from '@/context/AuthContext'; // Import auth hook
import LoadingSpinner from '@/components/LoadingSpinner'; // Loading spinner component
import ErrorMessage from '@/components/ErrorMessage'; // Error message component
// Import the adapted components
import LearningClassroomBanner from '@/components/LearningClassroomBanner';
import LearningClassroomStream from '@/components/LearningClassroomStream';
import LearningClassroomChatSidebar from '@/components/LearningClassroomChatSidebar';
// *** Import the LearningClassroomEntries component ***
import LearningClassroomEntries from '@/components/LearningClassroomEntries';

// Placeholder for other sections (will create later)
// import LearningClassroomClassmates from '@/components/LearningClassroomClassmates';
// import LearningClassroomSettings from '@/components/LearningClassroomSettings';


// Define base min-height for layout
const MIN_HEIGHT_CONTENT = 'min-h-[calc(100vh-4rem-2rem)]'; // Full viewport height - Navbar height - top/bottom padding

const LearningClassroomDetailPage: React.FC = () => {
    // --- Get URL Params ---
    const params = useParams();
    const classroomId = params.classroomId as string; // Get the ID from the dynamic route segment

    // --- Auth State ---
    const { currentUser, userProfile, userRole, isAuthLoading, isProfileLoading } = useAuth();
    const router = useRouter();

    // --- Data State ---
    const [classroom, setClassroom] = useState<LearningClassroom | null>(null);
    // *** Add state for student profiles ***
    const [studentProfiles, setStudentProfiles] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Loading for main classroom data
    const [error, setError] = useState<string | null>(null);

     // --- Sidebar State ---
    const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);

    // --- Determine User Relationship based on fetched classroom data ---
    // Use useMemo to re-calculate only when classroom or currentUser changes
    const isTeacherMember = useMemo(() => {
        if (!currentUser || !classroom) return false;
         // Ensure teacherIds is an array before checking inclusion
        return Array.isArray(classroom.teacherIds) && classroom.teacherIds.includes(currentUser.uid);
    }, [currentUser, classroom]); // Recalculate if currentUser or classroom data changes

    const isAnyMember = useMemo(() => {
        if (!currentUser || !classroom) return false;
         // Ensure memberIds is an array before checking inclusion
        return Array.isArray(classroom.memberIds) && classroom.memberIds.includes(currentUser.uid);
    }, [currentUser, classroom]); // Recalculate if currentUser or classroom data changes


    // --- Fetch Classroom Data Effect ---
    useEffect(() => {
        // Wait for auth/profile loading AND ensure we have a classroomId from the URL
        if (isAuthLoading || isProfileLoading || !classroomId) {
            setIsLoading(true); // Keep loading state true
            console.log("Learning Detail Page Effect: Waiting for auth/profile or classroomId...");
            // If classroomId is missing after load, redirect or show error
            if (!isAuthLoading && !isProfileLoading && !classroomId) {
                setError("Invalid learning page ID provided.");
                setIsLoading(false);
            }
            return; // Exit effect
        }

        // If no user is logged in after loading, they cannot view this page (based on security rules)
         if (!currentUser) {
             console.log("Learning Detail Page Effect: Not logged in after auth load.");
             setIsLoading(false);
             // Redirect to login or show unauthorized message
             setError("You must be logged in to view this learning page.");
             // Optional: router.push('/login');
             return;
         }

        // Now that we have a user and classroomId, fetch the classroom data
        console.log(`Learning Detail Page Effect: Fetching classroom ${classroomId} for user ${currentUser.uid}...`);
        const fetchClassroom = async () => {
            setIsLoading(true); // Start loading for the main classroom data and profiles
            setError(null); // Clear previous errors
            setClassroom(null); // Clear previous classroom data
            setStudentProfiles([]); // Clear previous profiles

            try {
                const idToken = await currentUser.getIdToken(true);

                const headers: HeadersInit = {
                    'Authorization': `Bearer ${idToken}`, // Include auth token
                };

                // Fetch data from the backend API endpoint
                // The API now returns both classroom and studentProfiles
                const response = await fetch(`/api/learning-classrooms/${classroomId}`, { headers });

                // If fetch fails, check status for unauthorized/forbidden
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                     // Security rule denial (403) or Not Found (404) for invalid ID/non-member
                    if (response.status === 403) {
                         setError("Forbidden: You do not have access to this learning page. Please join first.");
                    } else if (response.status === 404) {
                         setError("Not Found: This learning page does not exist or you do not have access.");
                    } else {
                         // Other API errors
                         setError(errorBody.message || `Failed to fetch learning page (${response.status})`);
                    }
                    console.error(`❌ Learning Detail Page Effect: API Error ${response.status}`, errorBody);
                     setIsLoading(false); // Stop loading
                     return; // Stop execution
                }

                const data = await response.json(); // Expecting { classroom: {...}, studentProfiles: [...] }

                if (data.classroom) {
                    console.log(`Learning Detail Page Effect: Fetched classroom data for ${classroomId}.`);
                    setClassroom(data.classroom); // Set the classroom state
                     // Set the fetched student profiles state (ensure it's an array)
                    setStudentProfiles(Array.isArray(data.studentProfiles) ? data.studentProfiles : []);

                     // The isTeacherMember and isAnyMember useMemos will update now
                } else {
                     // Should ideally not happen if response is OK but no data
                    console.warn("Learning Detail Page Effect: Fetched classroom but no data in response.");
                    setError("Could not load learning page data.");
                }

            } catch (err: any) {
                console.error('❌ Learning Detail Page Effect: Error fetching classroom:', err);
                setError(err.message || 'Could not load learning page data.');
            } finally {
                setIsLoading(false); // Stop loading regardless of success/failure
                console.log("Learning Detail Page Effect: Main classroom data fetch complete.");
            }
        };

        fetchClassroom();

    }, [classroomId, currentUser, isAuthLoading, isProfileLoading]); // Dependencies: Rerun if classroomId, currentUser, or loading states change

    // --- Render Loading/Error/Unauthorized States ---
    if (isLoading || isAuthLoading || isProfileLoading) {
        // Show loading if fetching classroom data OR auth/profile is loading
        return (
             <div className={`flex justify-center items-center pt-16 ${MIN_HEIGHT_CONTENT}`}>
                <LoadingSpinner />
             </div>
        );
    }

    if (error) {
        // Show error message if fetching failed or unauthorized
        return (
             <div className={`container mx-auto px-4 py-8 mt-16 text-center ${MIN_HEIGHT_CONTENT}`}>
                 <ErrorMessage message={error} />
                 {/* Optional: Link back to list or join page based on error */}
                 {(error.includes("access") || error.includes("join") || error.includes("exist")) ? ( // Check for common access/not found errors
                     <p className="mt-4"><Link href="/learning" className="text-blue-600 hover:underline">Back to Learning Pages</Link></p>
                 ) : null}
             </div>
        );
    }

    // If not loading, no error, and no classroom data found (shouldn't happen if API returns 404 with error)
    // This is a fallback check
    if (!classroom) {
         return (
              <div className={`container mx-auto px-4 py-8 mt-16 text-center ${MIN_HEIGHT_CONTENT}`}>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Learning Page Not Found</h1>
                  <p className="text-gray-600 mb-4">The specified learning page could not be loaded.</p>
                  <Link href="/learning" className="text-blue-600 hover:underline">Back to Learning Pages</Link>
             </div>
         );
    }

    // --- Render Classroom Detail View (if data is loaded and user is a member) ---
    // isAnyMember check is implicitly handled by the API's read permission returning 403/404
    // If we reach here, the user *should* be a member according to the successful API response.

    return (
        // Main container for the detail page content
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 mt-16">
            {/* Classroom Banner */}
            {/* Pass the fetched classroom data and the calculated isTeacherMember status */}
            <LearningClassroomBanner
                 classroom={classroom}
                 isTeacher={isTeacherMember} // Pass the specific teacher status for this classroom
                 // Placeholder for delete handler - will implement later
                 // onDeleteRequest={() => setShowDeleteModal(true)}
                 onToggleChatSidebar={() => setIsChatSidebarOpen(prev => !prev)} // Handler to toggle chat sidebar
            />

            {/* Main content area below the banner */}
            {/* Simple flex container for layout, expands left section */}
            <div className="flex flex-col md:flex-row gap-6 relative"> {/* Added md:flex-row for desktop layout */}
                {/* Left side: Stream and Entries sections */}
                {/* Use flex-grow to make this section take up available space */}
                {/* Set a base width like md:basis-2/3 if you want the right sidebar to push content */}
                {/* If the sidebar is fixed/floating, flex-grow is sufficient */}
                <div className="flex-grow">
                    {/* Placeholder for tabs/sections - can replace with tabs later */}
                    {/* For now, just render the Stream and the Entries section */}

                    {/* Stream Section */}
                    <LearningClassroomStream
                        classroomId={classroomId}
                        isTeacher={isTeacherMember} // Pass teacher status to stream
                        currentUser={currentUser} // Pass current user for posting
                     />

                     <div className="border-t border-gray-200 my-8"></div> {/* Separator */}

                     {/* *** Learning Entries Section *** */}
                     <LearningClassroomEntries
                         classroomId={classroomId}
                         currentUser={currentUser}
                         isTeacher={isTeacherMember}
                         studentIds={classroom.studentIds || []} // Pass student IDs array (provide fallback)
                         teacherIds={classroom.teacherIds || []} // Pass teacher IDs array (provide fallback)
                         // *** Pass the fetched studentProfiles array ***
                         studentProfiles={studentProfiles}
                     />

                     {/* Placeholder for Classmates Section */}
                      {/* <div className="border-t border-gray-200 my-8"></div>
                      <LearningClassroomClassmates
                         classroomId={classroomId}
                         isTeacher={isTeacherMember}
                         currentUser={currentUser}
                         studentIds={classroom.studentIds || []}
                         teacherIds={classroom.teacherIds || []}
                          studentProfiles={studentProfiles} // Pass profiles here too if needed
                         // ... other props
                     /> */}

                </div>

                {/* Right side: Chat Sidebar */}
                {/* This component is fixed/floating, its position controlled by its own CSS and `isOpen` prop */}
                {/* It is rendered here regardless of isOpen, but its visibility is toggled internally */}
                 <LearningClassroomChatSidebar
                     classroomId={classroomId}
                     classroomName={classroom.name} // Pass classroom name for header
                     currentUser={currentUser}
                     commentsEnabled={classroom.commentsEnabled ?? true} // Pass comments enabled status, default true
                     isOpen={isChatSidebarOpen} // Control visibility
                     onClose={() => setIsChatSidebarOpen(false)} // Handle close action
                  />
            </div>


            {/* Placeholder for Delete Confirmation Modal */}
            {/* {showDeleteModal && (
                 <Modal onClose={() => setShowDeleteModal(false)}>
                     <DeleteConfirmation onConfirm={handleDeleteClassroom} onCancel={() => setShowDeleteModal(false)} />
                 </Modal>
            )} */}

        </div>
    );
};

export default LearningClassroomDetailPage;