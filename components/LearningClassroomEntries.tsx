// components/LearningClassroomEntries.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { StudentLearningEntry, UserProfile } from '@/lib/types/learning';
import { useAuth } from '@/context/AuthContext';

import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

// *** Import the form and detail modal components ***
import LearningEntryFormModal from '@/components/LearningEntryFormModal'; // Adjust path if necessary
import LearningEntryDetailModal from '@/components/LearningEntryDetailModal'; // Adjust path if necessary

// Placeholder components (create empty files for these)
// import StudentEntryCard from './StudentEntryCard';
// import StudentNameItem from './StudentNameItem';


interface LearningClassroomEntriesProps {
    classroomId: string;
    currentUser: User | null;
    isTeacher: boolean;
    studentIds: string[];
    teacherIds: string[];
    studentProfiles: UserProfile[];
}

const LearningClassroomEntries: React.FC<LearningClassroomEntriesProps> = ({
    classroomId,
    currentUser,
    isTeacher,
    studentIds,
    teacherIds,
    studentProfiles,
}) => {
    // --- State ---
    const [entries, setEntries] = useState<StudentLearningEntry[]>([]);
    const [isLoadingEntries, setIsLoadingEntries] = useState(true);
    const [errorEntries, setErrorEntries] = useState<string | null>(null);

    // State for teachers: Which student's entries are currently selected?
    const [selectedStudentIdForTeacher, setSelectedStudentIdForTeacher] = useState<string | null>(null);

    // State for entry interaction: Which entry is currently selected for detail/edit?
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null); // Holds the ID of the entry being viewed/edited

    // State to control modals visibility
    const [showEntryFormModal, setShowEntryFormModal] = useState(false); // Controls the Create/Edit Form modal
    const [showEntryDetailModal, setShowEntryDetailModal] = useState(false); // Controls the Detail/Feedback modal


    // Get auth/profile loading states from AuthContext
    const { isAuthLoading, isProfileLoading } = useAuth();


    // --- Determine which student's entries to fetch ---
    const studentIdToFetch = useMemo(() => {
        if (!currentUser) return null;
        if (isTeacher) {
            return selectedStudentIdForTeacher;
        } else {
            return currentUser.uid;
        }
    }, [currentUser, isTeacher, selectedStudentIdForTeacher]);


     // --- Helper function to get student name from studentProfiles ---
     const getStudentName = useCallback((studentId: string): string => {
         const studentProfile = Array.isArray(studentProfiles) ?
             studentProfiles.find(profile => profile.uid === studentId) :
             undefined;
         return studentProfile?.displayName || `Student ${studentId.substring(0, 6)}...`;
     }, [studentProfiles]);


    // --- Function to re-fetch entries ---
    // Use useCallback for stability
     const refetchEntries = useCallback(async () => {
          if (currentUser && classroomId && studentIdToFetch && !isLoadingEntries) {
               console.log("Learning Entries Refetching...");
               setIsLoadingEntries(true);
               setErrorEntries(null);
               setEntries([]); // Clear current list optimistically during refetch
               try {
                    const idToken = await currentUser.getIdToken(true);
                     const apiUrl = isTeacher ?
                                   `/api/learning-classrooms/${classroomId}/learning-entries?studentId=${studentIdToFetch}` :
                                   `/api/learning-classrooms/${classroomId}/learning-entries`;
                    const response = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${idToken}` } });
                    if (!response.ok) {
                         const errData = await response.json().catch(() => ({}));
                          console.error("Refetch entries API error:", response.status, errData);
                         // Check if refetch failed because the student was deleted (e.g., in teacher view after student removed)
                         // Or if the user is no longer a member (parent page should handle this)
                         setErrorEntries(errData.message || `Failed to refresh entries (${response.status}).`);
                         setEntries([]); // Clear on refetch error
                         return; // Stop execution
                    }
                    const data = await response.json();
                    if (data.entries && Array.isArray(data.entries)) {
                         setEntries(data.entries);
                    } else { setEntries([]); }
                    console.log("Refetch successful.");
               } catch (err: any) {
                    console.error("Learning Entries Refetch error:", err);
                    setErrorEntries(err.message || "Failed to refresh entries.");
                    setEntries([]);
               } finally {
                    setIsLoadingEntries(false);
               }
          } else {
              // console.log("Learning Entries Refetch skipped: Conditions not met or already loading.");
              // If we were loading before the refetch call, make sure loading stops eventually
               if(isLoadingEntries) setIsLoadingEntries(false);
          }
     }, [classroomId, currentUser, isTeacher, studentIdToFetch, isLoadingEntries]); // Depend on state used for fetching

    // --- Effect to Fetch Learning Entries ---
    useEffect(() => {
        // Only trigger the initial fetch if authentication/profile is loaded and we have a target student ID
         if (!isAuthLoading && !isProfileLoading && currentUser && classroomId && studentIdToFetch) {
            console.log("Learning Entries Effect: Triggering initial fetch.");
            refetchEntries(); // Call the refetch function
         } else if (!isAuthLoading && !isProfileLoading && currentUser && classroomId && isTeacher && !studentIdToFetch) {
             // Specific case: Teacher is logged in, classroom loaded, but no student selected yet.
             // Stop loading state here and wait for teacher interaction.
             setIsLoadingEntries(false);
             setEntries([]); // Ensure list is empty
         } else if (!isAuthLoading && !isProfileLoading) {
             // Case: Auth/Profile loaded, but no user or classroomId missing.
             // This should be handled by the parent page showing error/redirect.
             // Ensure loading is off here.
             setIsLoadingEntries(false);
             setEntries([]); // Ensure list is empty
         }

    }, [classroomId, currentUser, isTeacher, studentIdToFetch, isAuthLoading, isProfileLoading, refetchEntries]); // Dependencies


    // --- Handlers for Modal Actions ---
    const handleOpenCreateModal = useCallback(() => {
         // Check if user is logged in and is NOT a teacher (only students create)
         if (!currentUser || isTeacher) {
             console.warn("Attempted to open create modal by unauthorized user.");
             // Optional: Show an error message like "Only students can create entries"
             return;
         }
         console.log("Opening create entry modal...");
         setSelectedEntryId(null); // Ensure no entry is selected for editing
         setShowEntryFormModal(true); // Open the form modal in create mode
    }, [currentUser, isTeacher]);


    const handleOpenEditModal = useCallback((entryId: string) => {
        // Check if user is logged in and is NOT a teacher (only students edit their own)
        if (!currentUser || isTeacher) {
             console.warn("Attempted to open edit modal by unauthorized user.");
             // Optional: Show an error message like "Only students can edit their own entries"
             return;
         }
         // Optional: Client-side check if currentUser.uid is the studentId for this entry
         // API will enforce ownership check anyway.
         console.log(`Opening edit entry modal for entry ID: ${entryId}`);
         setSelectedEntryId(entryId); // Set the entry ID to load for editing
         setShowEntryFormModal(true); // Open the form modal in edit mode
    }, [currentUser, isTeacher]);


    const handleOpenDetailModal = useCallback((entryId: string) => {
        // Anyone who can read the entry can view the detail modal (student owner or teacher member)
        // API rules enforce read permission.
        if (!currentUser) {
             console.warn("Attempted to open detail modal by unauthenticated user.");
             return;
         }
        console.log(`Opening entry detail modal for entry ID: ${entryId}`);
        setSelectedEntryId(entryId); // Set the entry ID to load for detail view
        setShowEntryDetailModal(true); // Open the detail modal
    }, [currentUser]);


     const handleModalClose = useCallback(() => {
         console.log("Closing modal.");
         // Reset modal states and selected entry ID
         setShowEntryFormModal(false);
         setShowEntryDetailModal(false);
         setSelectedEntryId(null); // Clear selected entry when modal closes

         // Refetch entries after any modal action (create, edit, delete from detail modal)
         // This updates the list to reflect changes.
         refetchEntries(); // Call the refetch function
     }, [refetchEntries]); // Dependency on refetchEntries


    // --- Render ---
    // Show a combined loading state for the initial data fetch of entries, or if auth/profile is loading
    if (isLoadingEntries || isAuthLoading || isProfileLoading) {
        return (
            <div className="flex justify-center items-center py-8">
                <LoadingSpinner />
            </div>
        );
    }

    // Show error if fetching entries failed
    if (errorEntries) {
        return (
            <div className="py-8">
                <ErrorMessage message={errorEntries} />
            </div>
        );
    }

    // --- Teacher View: List of Students or Entries for Selected Student ---
    if (isTeacher) {
        // If teacher hasn't selected a student yet, show the list of students
        if (!selectedStudentIdForTeacher) {
            // Ensure studentProfiles array exists and is not empty
            const studentsInClass = Array.isArray(studentProfiles) ? studentProfiles : [];

            return (
                 <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Student Entries</h3>
                    {studentsInClass.length === 0 ? (
                         <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg text-gray-600">
                            No students have joined this learning page yet.
                         </div>
                    ) : (
                         // List students. Clicking a student name sets selectedStudentIdForTeacher state.
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Map over studentProfiles to display student cards */}
                            {studentsInClass.map(studentProfile => (
                                 <div
                                    key={studentProfile.uid}
                                    onClick={() => setSelectedStudentIdForTeacher(studentProfile.uid)}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer text-gray-800 font-medium"
                                    title={`View entries for ${studentProfile.displayName || `Student ${studentProfile.uid.substring(0, 6)}...`}`}
                                 >
                                    {/* Display student's name and avatar */}
                                    <div className="flex items-center gap-3">
                                         <img
                                             src={studentProfile.photoURL || '/default-avatar.png'}
                                             alt="" // Alt text handled by title
                                             className="w-8 h-8 rounded-full border border-gray-200 flex-shrink-0"
                                         />
                                         <span className="truncate">{studentProfile.displayName || `Student ${studentProfile.uid.substring(0, 6)}...`}</span>
                                    </div>
                                 </div>
                            ))}
                         </div>
                    )}
                 </div>
            );
        }

        // If teacher HAS selected a student, show that student's entries
        // The entries state already contains the fetched entries for this studentIdToFetch
        // Find the selected student's profile to display their name in the heading
        const selectedStudentProfile = Array.isArray(studentProfiles) ?
             studentProfiles.find(profile => profile.uid === selectedStudentIdForTeacher) :
             undefined;
        const selectedStudentName = selectedStudentProfile?.displayName || `Student ${selectedStudentIdForTeacher?.substring(0, 6) || '...'}`;


        return (
            <div className="space-y-6">
                {/* Heading with back button to student list */}
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => setSelectedStudentIdForTeacher(null)} className="text-blue-600 hover:underline text-sm font-medium">
                         ← Back to Student List
                    </button>
                    {/* Display selected student's name */}
                     <h3 className="text-xl font-semibold text-gray-800 truncate">
                         Entries for {selectedStudentName}
                    </h3>
                </div>

                {entries.length === 0 ? (
                     <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg text-gray-600">
                        {selectedStudentName} has no entries yet.
                     </div>
                ) : (
                    // List the selected student's entries
                    <div className="space-y-4">
                         {entries.map(entry => (
                             // TODO: Create StudentEntryCard component to display entry summary
                             // For now, use placeholder div, clicking opens Detail Modal
                             <div
                                 key={entry.id}
                                 className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer text-gray-800"
                                 onClick={() => handleOpenDetailModal(entry.id!)}
                                 title={`View details for "${entry.title}"`}
                              >
                                 {/* Placeholder for StudentEntryCard content */}
                                 <h4 className="text-lg font-semibold">{entry.title}</h4>
                                 <p className="text-sm text-gray-600">Type: {entry.learningType} | Date: {entry.entryDate ? new Date(entry.entryDate.toString()).toLocaleDateString() : 'N/A'}</p>
                                 <p className="text-xs text-gray-500 mt-2 line-clamp-2">{entry.tasksPerformed}</p>
                                 {/* TODO: Add indicator if feedback exists for this entry */}
                             </div>
                         ))}
                    </div>
                )}
            </div>
        );
    }

    // --- Student View: List of Student's Own Entries ---
    // If not a teacher, assume user is a student member (API fetch ensures this)
    const studentsOwnEntries = entries; // entries state already filtered for the current student

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold text-gray-800">My Learning Entries</h3>
                  {/* Button to add a new entry - only for students who are members */}
                 {/* Check if current user is a student member of this classroom */}
                 {(!isAuthLoading && !isProfileLoading && currentUser && Array.isArray(studentIds) && studentIds.includes(currentUser.uid) ) && (
                      <button
                         onClick={handleOpenCreateModal} // Open create modal
                         className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 text-sm font-medium"
                      >
                         + Add New Entry
                      </button>
                 )}
             </div>


            {studentsOwnEntries.length === 0 ? (
                 <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg text-gray-600">
                    You haven't created any learning entries for this page yet.
                 </div>
            ) : (
                 // List the student's own entries
                <div className="space-y-4">
                     {studentsOwnEntries.map(entry => (
                         // TODO: Create StudentEntryCard component to display entry summary
                         // For now, use placeholder div, clicking opens Detail Modal
                         <div
                             key={entry.id}
                             className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer text-gray-800"
                              onClick={() => handleOpenDetailModal(entry.id!)} // Open detail modal on click
                             title={`View details for "${entry.title}"`}
                          >
                             {/* Placeholder for StudentEntryCard content */}
                             <h4 className="text-lg font-semibold">{entry.title}</h4>
                             <p className="text-sm text-gray-600">Type: {entry.learningType} | Date: {entry.entryDate ? new Date(entry.entryDate.toString()).toLocaleDateString() : 'N/A'}</p>
                             <p className="text-xs text-gray-500 mt-2 line-clamp-2">{entry.tasksPerformed}</p>
                             {/* TODO: Add indicator if feedback exists */}
                         </div>
                     ))}
                </div>
            )}

            {/* --- Modals for Create/Edit/Detail --- */}
            {/* Render the Form Modal conditionally */}
            {showEntryFormModal && (
                <LearningEntryFormModal
                    classroomId={classroomId}
                    entryId={selectedEntryId} // Will be null for create, ID for edit
                    currentUser={currentUser} // Pass current user
                    isTeacher={isTeacher} // Pass teacher status (should be false here)
                    onClose={handleModalClose} // Pass the close handler
                    onSuccess={handleModalClose} // Call handleModalClose after successful save/update
                 />
            )}
             {/* Render the Detail Modal conditionally */}
             {showEntryDetailModal && (
                 <LearningEntryDetailModal
                     classroomId={classroomId}
                     entryId={selectedEntryId} // Pass selectedEntryId
                     currentUser={currentUser} // Pass current user
                     isTeacher={isTeacher} // Needed to show feedback form/edit option
                     onClose={handleModalClose} // Pass the close handler
                     onEdit={() => { // Handler to switch to edit mode from detail view
                         setShowEntryDetailModal(false); // Close detail
                         // selectedEntryId is already set by handleOpenDetailModal
                         setShowEntryFormModal(true); // Open the form modal for editing
                     }}
                      // onDeleteSuccess is handled by handleModalClose calling refetchEntries
                 />
             )}

        </div>
    );
};

export default LearningClassroomEntries;