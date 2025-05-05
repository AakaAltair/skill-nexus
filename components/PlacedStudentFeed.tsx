// components/PlacedStudentFeed.tsx
"use client";

import React, { useState, useEffect, FormEvent, useRef, useCallback, useMemo } from 'react';
// Import necessary types
import { StudentAchievement, PlacementType } from '@/lib/types/placement'; // Adjust path if needed
// Import User type from firebase/auth - needed for currentUser type hint
import { User } from 'firebase/auth';
// Assuming types for AchievementComment/AchievementLike exist if needed for detail view
// import { AchievementComment, AchievementLike } from '@/lib/types/placement';

// Import utility functions
import { formatSimpleDate } from '@/lib/dateUtils'; // For formatting dates
// Assuming themeUtils is used for card background gradients
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Reusing theme logic

// Import child components
import Modal from './Modal'; // For the detail/edit modal (ensure path is correct)
import PlacedStudentPost from './PlacedStudentPost'; // Import the display card component
import Link from 'next/link'; // Import Link for create button
// Import useRouter from next/navigation for use in the component
import { useRouter } from 'next/navigation';


// Import icons for modal actions and filters
import { Plus, Pencil, Trash2, Save, Upload, Search, Filter } from 'lucide-react'; // Added Save, Upload, Search, Filter

// --- Props Interface ---
// Updated props interface to match what's passed from app/placements/page.tsx
interface PlacedStudentFeedProps {
  currentUser: User | null; // User from AuthContext
  isLoading: boolean; // isLoading state from AuthContext (general page loading)
  // initialAchievements, error props removed as the component now fetches its own data
}

// --- Placement Type Options for Filter Dropdown ---
const placementTypeFilterOptions: Array<PlacementType | 'All'> = ['All', 'Full-time', 'Internship', 'PPO', 'Other'];
// --- Placement Type Options for Modal Dropdown (without 'All') ---
const placementTypeModalOptions: Array<PlacementType | ''> = ['', 'Full-time', 'Internship', 'PPO', 'Other'];

// --- Define types for feed view state ---
type AchievementFeedView = 'all' | 'myPosts';


// --- Placed Student Feed Component ---
const PlacedStudentFeed: React.FC<PlacedStudentFeedProps> = ({
    currentUser,
    isLoading, // isLoading from AuthContext
}) => {
    const router = useRouter(); // Initialize router - now correctly imported


    // --- State ---
    // Data States
    // Component now manages fetching its own full list
    const [allAchievements, setAllAchievements] = useState<StudentAchievement[]>([]); // Stores the full list
    const [displayedAchievements, setDisplayedAchievements] = useState<StudentAchievement[]>([]); // State for filtered list to display

    // --- Filter & View State (Specific to this feed) ---
    const [activeFeedView, setActiveFeedView] = useState<AchievementFeedView>('all'); // State to track active view
    const [achievementSearchTerm, setAchievementSearchTerm] = useState('');
    const [selectedPlacementTypeFilter, setSelectedPlacementTypeFilter] = useState<PlacementType | 'All'>('All');

    // --- State for VIEW/EDIT Modal ---
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedAchievement, setSelectedAchievement] = useState<StudentAchievement | null>(null); // The achievement being viewed/edited
    const [isEditingAchievement, setIsEditingAchievement] = useState(false); // Toggle view/edit mode in modal
    const [editData, setEditData] = useState<Partial<StudentAchievement>>({}); // Holds data being edited in modal


    // Loading/Error states for the feed list fetch itself (internal)
    const [isLoadingAchievements, setIsLoadingAchievements] = useState(true); // Internal loading state for the feed fetch
    const [achievementError, setAchievementError] = useState<string | null>(null); // Internal error state for feed fetch

    // Loading/Error states for actions within the DETAIL/EDIT modal
    const [isUpdatingAchievement, setIsUpdatingAchievement] = useState(false); // For save action loading
    const [isDeletingAchievement, setIsDeletingAchievement] = useState(false); // For delete action loading
    const [updateError, setUpdateError] = useState<string | null>(null); // For save/delete errors in modal
    const [successMessage, setSuccessMessage] = useState<string | null>(null); // For save success message in modal


    // Refs for textareas in the edit modal (for auto-resize)
    const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
    const editJobDescRef = useRef<HTMLTextAreaElement>(null);
    const editPersonalMsgRef = useRef<HTMLTextAreaElement>(null);


    // --- Handlers (Declared using useCallback - moved BEFORE effects) ---

    // --- Function to Refetch Achievements (MOVED HERE) ---
     // Used after updating or deleting a post to get the latest data and refresh the feed
      const refetchAchievements = useCallback(async () => {
         console.log("Refetching achievements...");
         // Do NOT show main loading spinner for refetch, maybe a subtle indicator elsewhere if desired
         // setIsLoadingAchievements(true); // Avoid this for refetch, only for initial load

         try {
             // Refetch the *entire* list to ensure we have the latest data for both 'all' and 'myPosts' views
             const response = await fetch('/api/placement/achievements'); // Ensure correct API path
             if (!response.ok) {
                  // Log error but don't necessarily block UI or show major error state for a failed refetch
                  console.error(`Refetch failed (${response.status})`);
                  // Optionally show a temporary notification
                  // setUpdateError("Failed to refresh feed."); setTimeout(() => setUpdateError(null), 3000);
                  return; // Stop if refetch failed
              }
             const data = await response.json();
             if (data.achievements && Array.isArray(data.achievements)) {
                 const sorted = data.achievements.sort((a: StudentAchievement, b: StudentAchievement) => new Date(b.createdAt?.toString() || 0).getTime() - new Date(a.createdAt?.toString() || 0).getTime() );
                 setAllAchievements(sorted); // Update the base list, filter effect will update display
             } else {
                 setAllAchievements([]);
                 console.warn("Refetched achievements data was not in expected array format.");
             }
             setUpdateError(null); // Clear any lingering edit/delete errors on successful refetch
         } catch (err: any) {
             console.error("Refetch achievements error:", err);
             // Handle refetch error (maybe show a temporary message)
             // setUpdateError("Failed to refresh feed."); setTimeout(() => setUpdateError(null), 3000);
         }
         // finally { setIsLoadingAchievements(false); } // Avoid this for refetch
     }, []); // No dependencies needed for basic refetch


    // Handler for clicking on an achievement card to open modal
    const handleViewAchievementDetails = useCallback((achievement: StudentAchievement) => {
        console.log("Opening detail modal for achievement:", achievement.id);
        setSelectedAchievement(achievement); // Set the achievement data to display

        // Initialize editData with current achievement details for when switching to edit mode
        // Convert skills array back to a comma-separated string for the input field
        setEditData({
            placedStudentName: achievement.placedStudentName || '',
            placedStudentBranch: achievement.placedStudentBranch || '',
            placedStudentYear: achievement.placedStudentYear || '',
            placedStudentPhotoURL: achievement.placedStudentPhotoURL || '', // Assuming this exists
            companyName: achievement.companyName || '',
            companyLogoURL: achievement.companyLogoURL || '', // Assuming this exists
            roleTitle: achievement.roleTitle || '',
            placementType: achievement.placementType || '',
            location: achievement.location || '',
            salary: achievement.salary || '',
            skills: (achievement.skills || []).join(', '), // Convert array to string for the input field
            jobDescription: achievement.jobDescription || '',
            text: achievement.text || '',
            personalMessage: achievement.personalMessage || '',
        });

        setIsEditingAchievement(false); // Ensure it opens in view mode initially
        setUpdateError(null); setSuccessMessage(null); // Clear previous messages/errors
        setIsUpdatingAchievement(false); // Reset loading state for actions
        setIsDeletingAchievement(false); // Reset deleting state
        setIsDetailModalOpen(true); // Open the modal
        // Optionally fetch comments here if needed for the modal
    }, []); // Empty dependency array - these states/setters are stable

    // Closes the detail/edit modal and resets related state
    const handleCloseDetailModal = useCallback(() => {
        console.log("Closing detail modal.");
        setIsDetailModalOpen(false); // Close the modal
        // Reset all state related to the modal
        setSelectedAchievement(null);
        setIsEditingAchievement(false);
        setEditData({});
        setUpdateError(null);
        setSuccessMessage(null);
        setIsUpdatingAchievement(false);
        setIsDeletingAchievement(false);
    }, []); // Empty dependency array - these setters are stable

    // Toggles between view and edit mode within the detail modal
    const toggleEditMode = useCallback(() => {
        console.log("Toggling edit mode.");
        // If switching *to* edit mode, ensure editData reflects the selected achievement accurately.
        // This is already done in handleViewAchievementDetails, but a refresh here is safe.
        if (!isEditingAchievement && selectedAchievement) {
             setEditData({
                placedStudentName: selectedAchievement.placedStudentName || '',
                placedStudentBranch: selectedAchievement.placedStudentBranch || '',
                placedStudentYear: selectedAchievement.placedStudentYear || '',
                placedStudentPhotoURL: selectedAchievement.placedStudentPhotoURL || '',
                companyName: selectedAchievement.companyName || '',
                companyLogoURL: selectedAchievement.companyLogoURL || '',
                roleTitle: selectedAchievement.roleTitle || '',
                placementType: selectedAchievement.placementType || '',
                location: selectedAchievement.location || '',
                salary: selectedAchievement.salary || '',
                skills: (selectedAchievement.skills || []).join(', '), // Convert array back to string
                jobDescription: selectedAchievement.jobDescription || '',
                text: selectedAchievement.text || '',
                personalMessage: selectedAchievement.personalMessage || '',
             });
        }
        setIsEditingAchievement(prev => !prev); // Toggle the mode state
        setUpdateError(null); setSuccessMessage(null); // Clear messages when toggling mode
    }, [isEditingAchievement, selectedAchievement]); // Depend on these states for updating editData

    // Handles changes in the edit form inputs (text, textarea, select)
    const handleEditInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    }, []); // Empty dependency array - setEditData is stable

    // Specific handler for skills input (if stored as comma-separated string in editData)
    const handleEditSkillsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
         const { name, value } = e.target;
         // Keep skills as a string in editData state
         setEditData(prev => ({ ...prev, [name]: value }));
    }, []); // Empty dependency array - setEditData is stable


    // Handle Saving Changes after editing (PATCH request)
    // This function is triggered by the form's onSubmit in the modal
    const handleSaveChanges = useCallback(async () => {
        // Basic validation checks before sending request
        if (!currentUser || !selectedAchievement?.id || !isEditingAchievement) {
            console.warn("Save denied: User not logged in, no achievement selected, or not in edit mode.");
             setUpdateError("Cannot save: Missing data or authentication.");
            return;
        }
        // More specific validation for required fields
         if (!editData.placedStudentName?.trim() || !editData.companyName?.trim() || !editData.text?.trim()) {
             setUpdateError("Placed Student Name, Company Name, and Experience/Advice are required.");
             return;
         }

        setIsUpdatingAchievement(true); // Start saving indicator
        setUpdateError(null); setSuccessMessage(null); // Clear previous messages

        // Prepare the payload with only the fields that might have changed
        const payload: Partial<StudentAchievement> = {};
        const fieldsToCompare: Array<keyof StudentAchievement> = [
             'placedStudentName', 'placedStudentBranch', 'placedStudentYear', 'placedStudentPhotoURL',
             'companyName', 'companyLogoURL', 'roleTitle', 'placementType', 'location', 'salary',
             'jobDescription', 'skills', 'text', 'personalMessage'
        ];

        let skillsArray: string[] | undefined;
        // Process skills input string into an array
        if (typeof editData.skills === 'string') {
            skillsArray = editData.skills.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Compare editData values (or processed values like skillsArray) with the original selectedAchievement data
        fieldsToCompare.forEach(key => {
             // Get the value from the form state (editData)
             let formValue: any = key === 'skills' ? skillsArray : editData[key];
             // Get the original value from the fetched achievement data
             let initialValue: any = key === 'skills' ? (selectedAchievement.skills || []) : selectedAchievement[key];

             let hasChanged = false;

             if (key === 'skills') {
                 // Deep compare arrays (handle null/undefined/empty arrays)
                 const formSkills = formValue || [];
                 const initialSkills = initialValue || [];
                 hasChanged = JSON.stringify(formSkills) !== JSON.stringify(initialSkills);
                 if(hasChanged) {
                      // Add the processed skills array to the payload
                      payload.skills = formSkills;
                 }
             } else {
                 // Compare other field types (trim strings for comparison)
                 const currentVal = (typeof formValue === 'string' ? formValue.trim() : formValue) ?? undefined;
                 const initialVal = (typeof initialValue === 'string' ? initialValue.trim() : initialValue) ?? undefined;

                 hasChanged = currentVal !== initialVal;

                 if (hasChanged) {
                     // Add the field to the payload. Handle empty strings for optional fields.
                     payload[key] = (typeof formValue === 'string' && formValue.trim() === '') ? null : (typeof formValue === 'string' ? formValue.trim() : formValue);
                 }
             }
        });

        // If no fields have changed, don't send the request
        if (Object.keys(payload).length === 0) {
            console.log("No changes detected, skipping save.");
            setSuccessMessage("No changes detected.");
            setIsEditingAchievement(false); // Exit edit mode if no changes
            setIsUpdatingAchievement(false);
            setTimeout(() => setSuccessMessage(null), 2500); // Clear success message briefly
            return; // Stop the function
        }

        console.log("Saving changes with payload:", payload);

        try {
            // Get a fresh auth token for the API call
            const idToken = await currentUser.getIdToken(true);
            const response = await fetch(`/api/placement/achievements/${selectedAchievement.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify(payload), // Send only the detected changes
            });

            if (!response.ok) {
                const d = await response.json().catch(() => ({}));
                throw new Error(d.error || `Update failed (${response.status})`);
            }

            const result = await response.json();
            console.log("Achievement saved successfully:", result.achievement);

            // Refetch the entire list to ensure the feed is up-to-date
            // This is simpler than manually updating the item in `allAchievements` state
            await refetchAchievements();

            // Update the selected achievement data in state with the returned data
            // This ensures the view mode in the modal shows the saved changes immediately
            if (result.achievement) {
                 setSelectedAchievement(result.achievement);
            }


            setIsEditingAchievement(false); // Exit edit mode on success
            setSuccessMessage("Changes saved successfully!"); // Show success message
            setTimeout(() => setSuccessMessage(null), 2500); // Clear success message after a delay

        } catch (err: any) {
            console.error("❌ Error saving achievement:", err);
            setUpdateError(err.message || "Could not save changes."); // Display error in modal
        }
        finally {
            setIsUpdatingAchievement(false); // Stop saving indicator
        }
    }, [currentUser, selectedAchievement, isEditingAchievement, editData, refetchAchievements]); // Dependencies for useCallback

     // Handle Deleting Achievement (DELETE request)
     // Triggered by the delete button in the modal
     const handleDeleteAchievement = useCallback(async () => {
         // Ensure user is logged in and an achievement is selected
         if (!currentUser || !selectedAchievement?.id) {
             console.warn("Delete denied: User not logged in or no achievement selected.");
             setUpdateError("Cannot delete: Authentication or data missing."); // Use updateError for modal
             return;
         }

         // Add a user confirmation dialog
         if (!window.confirm(`Are you sure you want to delete this achievement post for ${selectedAchievement.placedStudentName} at ${selectedAchievement.companyName}? This cannot be undone.`)) {
             console.log("Delete cancelled by user.");
             return; // Stop if user cancels
         }

         setIsDeletingAchievement(true); // Start deleting indicator
         setUpdateError(null); // Clear previous errors
         setSuccessMessage(null); // Clear success messages

         try {
             // Get a fresh auth token for the API call
             const idToken = await currentUser.getIdToken(true);
             const response = await fetch(`/api/placement/achievements/${selectedAchievement.id}`, {
                 method: 'DELETE',
                 headers: { 'Authorization': `Bearer ${idToken}` },
             });

             if (!response.ok) {
                 const d = await response.json().catch(() => ({}));
                 throw new Error(d.error || `Delete failed (${response.status})`);
             }

             console.log("Achievement deleted successfully:", selectedAchievement.id);

             // Refetch the entire list to remove the deleted item from the feed
             await refetchAchievements();

             // Close the modal and clear the selected achievement state
             handleCloseDetailModal(); // Use the handler to reset all modal state

         } catch (err: any) {
             console.error("❌ Error deleting achievement:", err);
              setUpdateError(err.message || "Could not delete post."); // Display error in modal
         }
         finally {
             setIsDeletingAchievement(false); // Stop deleting indicator
         }
     }, [currentUser, selectedAchievement, refetchAchievements, handleCloseDetailModal]); // Dependencies


    // Memoized helper for generating button styles based on active view
     const getFeedButtonClasses = useCallback((view: AchievementFeedView): string => {
         const base = "px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 flex-shrink-0 whitespace-nowrap border";
         const isActive = activeFeedView === view;

         if (isActive) {
              // Use slightly different colors for feed buttons
              return `${base} bg-blue-600 border-blue-600 text-white shadow-sm`;
         } else {
             return `${base} bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400`;
         }
     }, [activeFeedView]); // Depend on the active view state


    // --- Effects (Declared AFTER handlers) ---

    // Effect: Fetch Achievements when component mounts or AuthContext loading/user changes
    // This effect fetches the *initial* list of achievements for the feed.
    const fetchAchievements = useCallback(async () => {
        // Wait for auth state to resolve before fetching,
        // especially if you might add 'my posts' filtering later based on currentUser.
        // If you *only* ever fetch 'all' posts regardless of user, you could remove the !isLoading check.
        if (isLoading) {
             console.log("PlacedStudentFeed: Waiting for auth context to load before fetching achievements.");
             return; // Don't fetch if auth state is not resolved yet
        }

        let mounted = true; // Flag to prevent state updates on unmounted component

        setIsLoadingAchievements(true); // Start internal loading indicator
        setAchievementError(null); // Clear previous errors
        setAllAchievements([]); // Clear previous data

        try {
            let url = '/api/placement/achievements';
            // TODO: If you add 'my posts' filtering to the feed UI, you'll modify the URL here
            // if (activeFeedView === 'myPosts' && currentUser) { url += `?userId=${currentUser.uid}`; }

            console.log("Fetching achievements from:", url);

            const response = await fetch(url);

            // Check mount status immediately after async operations
            if (!mounted) { console.log("PlacedStudentFeed fetch: Component unmounted."); return; }

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: `Fetch failed ${response.status}` }));
                throw new Error(errData.error || `Failed to fetch achievements (${response.status})`);
            }

            const data = await response.json();
            console.log("Achievements fetched successfully. Count:", data.achievements?.length || 0);

            if (mounted) {
                if (data.achievements && Array.isArray(data.achievements)) {
                     // Sort by creation date descending before setting state
                     const sorted = data.achievements.sort((a: StudentAchievement, b: StudentAchievement) =>
                         new Date(b.createdAt?.toString() || 0).getTime() - new Date(a.createdAt?.toString() || 0).getTime()
                     );
                     setAllAchievements(sorted); // Update the base list
                } else {
                    setAllAchievements([]); // Set empty array if format is unexpected
                     console.warn("Fetched achievements data was not in expected array format.");
                }
            }

        } catch (err: any) {
            console.error("Fetch Achievements Error:", err);
            if (mounted) {
                setAllAchievements([]); // Clear data on error
                setAchievementError(err.message || "Could not load achievements."); // Set descriptive error
            }
        } finally {
            if (mounted) {
                 setIsLoadingAchievements(false); // End internal loading indicator
                 console.log("Achievements fetch finished.");
            }
        }
    }, [isLoading, currentUser]); // Dependencies: isLoading and currentUser from AuthContext

    // Trigger the initial fetch when dependencies change
    useEffect(() => {
         fetchAchievements();
    }, [fetchAchievements]); // Depend on the memoized fetch function


    // --- Effect: Apply Achievement Filters (including the new view filter) ---
    // Filters the 'allAchievements' list based on current filter criteria
    useEffect(() => {
        // console.log("Applying client-side filters to achievements...");
        let filtered = [...allAchievements]; // Start with the full list (fetched data)

        // 1. Apply the View Filter ('all' vs 'myPosts')
        if (activeFeedView === 'myPosts' && currentUser) {
             filtered = filtered.filter(ach => ach.creatorId === currentUser.uid);
        } else if (activeFeedView === 'myPosts' && !currentUser) {
            // If 'myPosts' is selected but user is logged out, show empty
             filtered = [];
        }
        // If activeFeedView is 'all', no filtering needed at this step based on view

        // 2. Apply Placement Type Filter
        if (selectedPlacementTypeFilter !== 'All') {
            filtered = filtered.filter(ach => ach.placementType === selectedPlacementTypeFilter);
        }

        // 3. Apply Search Term Filter (across relevant text fields)
        if (achievementSearchTerm.trim()) {
            const lowerSearch = achievementSearchTerm.trim().toLowerCase();
            filtered = filtered.filter(ach =>
                ach.placedStudentName?.toLowerCase().includes(lowerSearch) ||
                ach.companyName?.toLowerCase().includes(lowerSearch) ||
                ach.roleTitle?.toLowerCase().includes(lowerSearch) ||
                ach.placedStudentBranch?.toLowerCase().includes(lowerSearch) || // Use placedStudentBranch consistent with type
                ach.location?.toLowerCase().includes(lowerSearch) ||
                ach.text?.toLowerCase().includes(lowerSearch) ||
                ach.skills?.some(skill => skill.toLowerCase().includes(lowerSearch)) // Check if any skill matches
            );
        }

        // Update the list that gets rendered
        setDisplayedAchievements(filtered);

    }, [allAchievements, achievementSearchTerm, selectedPlacementTypeFilter, activeFeedView, currentUser]); // Rerun when source list, filters, view, or user change


    // --- Textarea Auto-Resize Effect for EDIT Modal ---
     useEffect(() => {
        const resizeTextarea = (ref: React.RefObject<HTMLTextAreaElement>) => {
            if (ref.current) {
                const textarea = ref.current;
                textarea.style.height = 'auto'; // Reset height to calculate scrollHeight properly
                const scrollHeight = textarea.scrollHeight;
                const maxHeight = 160; // Define a max height if needed
                // Set height, but don't exceed maxHeight
                textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
                // Add overflowY auto if content exceeds maxHeight
                textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
            }
        };
        // Apply resize only when in edit mode and the data that affects content changes
        if (isEditingAchievement) {
             resizeTextarea(editTextAreaRef);
             resizeTextarea(editJobDescRef);
             resizeTextarea(editPersonalMsgRef);
        }
    // Depend on the data fields that go into textareas and the edit mode state
    }, [editData.text, editData.jobDescription, editData.personalMessage, isEditingAchievement]);


    // --- Styling Variables (Moved here to be defined before use in Render) ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 disabled:opacity-60";
    const selectStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-9";
    const modalButtonStyle = "px-4 py-1.5 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
    const postButtonStyle = `${modalButtonStyle} bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 flex items-center justify-center min-w-[80px]`; // Used for "Share Success"
    const saveButtonStyle = `${modalButtonStyle} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 flex items-center justify-center min-w-[80px]`; // Used for Save
    const cancelButtonStyle = `${modalButtonStyle} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-400`; // Used for Cancel Edit
    const deleteButtonStyle = `${modalButtonStyle} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 flex items-center justify-center min-w-[80px]`; // Used for Delete
    const editButtonStyle = `${modalButtonStyle} bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300 focus:ring-gray-400 flex items-center justify-center min-w-[80px]`; // Used for Edit button in view mode
    // const imageButtonStyle = `${modalButtonStyle} bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 inline-flex items-center gap-2`; // Not used in this version

    // Specific styles for the feed's inline filters
    const feedInputStyle = "bg-white border border-gray-300 rounded-md pl-8 pr-2 py-1 text-xs placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-offset-0 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-8";
    const feedSelectStyle = "bg-white border border-gray-300 rounded-md pl-2 pr-7 py-1 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-offset-0 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-8 appearance-none";


    // --- Render Feed ---
    return (
        // Main container for the right pane feed
        <div className="h-full flex flex-col bg-gray-100"> {/* Added flex-col and bg-gray-100 for the pane */}
            {/* Feed Header with Title and Link to Create Page */}
            <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0 flex flex-wrap justify-between items-center gap-2"> {/* Added flex-wrap and gap */}
                <h2 className="text-lg font-semibold text-gray-900 flex-shrink-0">Placement Success Stories</h2>

                {/* View Toggles and Share Button */}
                <div className="flex flex-wrap gap-2 items-center flex-shrink-0"> {/* Container for buttons */}
                     {/* All Achievements Button */}
                     <button onClick={() => setActiveFeedView('all')} className={getFeedButtonClasses('all')}> All Achievements </button>

                     {/* My Stories Button (Visible only if user is logged in) */}
                     {/* Use !isLoading from AuthContext */}
                     {!isLoading && currentUser && (
                         <button onClick={() => setActiveFeedView('myPosts')} className={getFeedButtonClasses('myPosts')}> My Stories </button>
                     )}

                     {/* Share Success Button (Visible only if user is logged in) */}
                     {!isLoading && currentUser && (
                         <Link href="/placements/achievements/create" legacyBehavior>
                              <a className={postButtonStyle}>
                                   <Plus size={18} className="-ml-1"/> Share Success
                              </a>
                         </Link>
                     )}
                      {/* Optional message if auth required for creating/my posts view */}
                      {!isLoading && !currentUser && (
                           <span className="text-xs text-gray-500 italic">(Log in to share/view your posts)</span>
                      )}
                </div>
            </div>

            {/* Minimal Filters Area for Achievements */}
             {/* These filters apply to the currently selected view ('all' or 'myPosts') */}
             <div className="p-3 border-b border-gray-200 bg-white flex-shrink-0 flex flex-col sm:flex-row gap-2 items-center">
                 {/* Search Input */}
                 <div className="relative w-full sm:w-auto sm:flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none"> <Search size={14} className="text-gray-400" /> </div>
                    <input type="search" placeholder="Search Name, Company, Role..." value={achievementSearchTerm} onChange={(e) => setAchievementSearchTerm(e.target.value)} className={feedInputStyle + " w-full"} aria-label="Search achievements"/>
                 </div>
                 {/* Placement Type Dropdown */}
                 <div className="relative w-full sm:w-auto">
                      <select value={selectedPlacementTypeFilter} onChange={(e) => setSelectedPlacementTypeFilter(e.target.value as PlacementType | 'All')} className={feedSelectStyle + " w-full"} aria-label="Filter by placement type">
                           {placementTypeFilterOptions.map(type => ( <option key={type} value={type}>{type === 'All' ? 'All Types' : type}</option> ))}
                      </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none"> <Filter size={14} className="text-gray-400" /> </div>
                 </div>
                 {/* Optional: My Posts/All Achievements toggle here */}
                 {/* {!isLoading && currentUser && ( ... My Posts Toggle JSX ...)} */}
             </div>

            {/* Achievement Feed Display Area */}
            <div className="flex-grow overflow-y-auto p-4"> {/* Added flex-grow to fill space */}
                 {/* Loading State for Feed Fetch (internal state) */}
                 {isLoadingAchievements && (
                      <div className="flex justify-center items-center text-gray-500 py-10">
                          <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                           Loading achievements...
                      </div>
                  )}
                 {/* Error State for Feed Fetch (internal state) */}
                 {achievementError && !isLoadingAchievements && (
                      <div className="text-center text-red-600 bg-red-50 border border-red-200 p-4 rounded-md py-10">
                           Error loading achievements: {achievementError}
                      </div>
                  )}
                {/* Empty State (considers filters AND view) */}
                {/* Show if not loading, no error, and the displayed (filtered) list is empty */}
                {!isLoadingAchievements && !achievementError && displayedAchievements.length === 0 && (
                    <p className="text-center text-gray-400 py-16 italic">
                       {/* Differentiate message if filters are active */}
                       {activeFeedView === 'myPosts' && currentUser ? "You haven't posted any achievements yet." :
                        activeFeedView === 'myPosts' && !currentUser ? "Please log in to view your posts." :
                        (achievementSearchTerm.trim() || selectedPlacementTypeFilter !== 'All' ? "No achievements match your filters." : "No placement achievements posted yet.")}
                    </p>
                )}
                 {/* Grid Layout for Achievement Posts */}
                 {/* Show only when not loading, no error, and there are items to display */}
                {!isLoadingAchievements && !achievementError && displayedAchievements.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Map over the FILTERED achievements */}
                        {displayedAchievements.map(achievement => (
                            // Wrap card in div to attach click handler for opening detail modal
                            <div key={achievement.id} onClick={() => handleViewAchievementDetails(achievement)}
                                 className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
                                 role="button" // Make it semantically a button for accessibility
                                 tabIndex={0} // Make it focusable
                                 onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleViewAchievementDetails(achievement)} // Handle keyboard activation
                            >
                                {/* Render the individual post card */}
                                <PlacedStudentPost achievement={achievement} />
                            </div>
                        ))}
                     </div>
                 )}
            </div>

            {/* --- Achievement Detail/Edit Modal --- */}
            {/* Using the generic Modal component */}
            <Modal
                isOpen={isDetailModalOpen} // Control modal visibility via state
                onClose={handleCloseDetailModal} // Handler to close the modal
                title={isEditingAchievement ? "Edit Achievement Post" : "Placement Details"} // Dynamic title based on mode
            >
                 {/* Modal Content Area */}
                 {/* max-h controls the height, overflow-y-auto adds scroll if content exceeds */}
                 {/* Only render content if an achievement is selected */}
                 {selectedAchievement ? (
                     <div className="space-y-4 max-h-[75vh] overflow-y-auto p-1 pr-2"> {/* Added padding/pr for scrollbar */}

                         {/* Render Edit Form OR View Details based on mode */}
                         {isEditingAchievement ? (
                            /* --- EDIT FORM (Inline JSX) --- */
                            // Bind form submission to handleSaveChanges
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }} className="space-y-4">

                                {/* Placement Details Fieldset */}
                                <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                                     <legend className="text-xs font-medium text-gray-600 px-1">Placement Details</legend>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2">
                                         {/* Student Name (Required) */}
                                         <div>
                                              <label htmlFor="editPlacedStudentName" className="block text-xs font-medium text-gray-700 mb-0.5">Student Name <span className="text-red-600">*</span></label>
                                              <input type="text" id="editPlacedStudentName" name="placedStudentName" value={editData.placedStudentName || ''} onChange={handleEditInputChange} required className={inputStyle} />
                                         </div>
                                         {/* Branch */}
                                         <div>
                                              <label htmlFor="editStudentBranch" className="block text-xs font-medium text-gray-700 mb-0.5">Branch/Dept</label>
                                              {/* Note: Type uses studentBranch, but type interface uses placedStudentBranch. Ensure consistency. Using placedStudentBranch here */}
                                              <input type="text" id="editStudentBranch" name="placedStudentBranch" value={editData.placedStudentBranch || ''} onChange={handleEditInputChange} className={inputStyle} />
                                         </div>
                                         {/* Company (Required) */}
                                         <div>
                                              <label htmlFor="editCompanyName" className="block text-xs font-medium text-gray-700 mb-0.5">Company <span className="text-red-600">*</span></label>
                                              <input type="text" id="editCompanyName" name="companyName" value={editData.companyName || ''} onChange={handleEditInputChange} required className={inputStyle} />
                                         </div>
                                         {/* Role Title */}
                                         <div>
                                              <label htmlFor="editRoleTitle" className="block text-xs font-medium text-gray-700 mb-0.5">Role Title</label>
                                              <input type="text" id="editRoleTitle" name="roleTitle" value={editData.roleTitle || ''} onChange={handleEditInputChange} className={inputStyle} />
                                         </div>
                                         {/* Placement Type Dropdown */}
                                         <div>
                                              <label htmlFor="editPlacementType" className="block text-xs font-medium text-gray-700 mb-0.5">Type</label>
                                              <select id="editPlacementType" name="placementType" value={editData.placementType || ''} onChange={handleEditInputChange} className={selectStyle}>
                                                   {/* Options include an empty one for 'Select Type' */}
                                                   {placementTypeModalOptions.map(type => ( <option key={type} value={type}>{type === '' ? 'Select Type' : type}</option> ))}
                                              </select>
                                         </div>
                                         {/* Location */}
                                         <div>
                                              <label htmlFor="editLocation" className="block text-xs font-medium text-gray-700 mb-0.5">Location</label>
                                              <input type="text" id="editLocation" name="location" value={editData.location || ''} onChange={handleEditInputChange} className={inputStyle} />
                                         </div>
                                         {/* Salary/Stipend */}
                                         <div>
                                              <label htmlFor="editSalary" className="block text-xs font-medium text-gray-700 mb-0.5">Salary/Stipend</label>
                                              <input type="text" id="editSalary" name="salary" value={editData.salary || ''} onChange={handleEditInputChange} className={inputStyle} />
                                         </div>
                                          {/* TODO: Add inputs for Photo URL and Company Logo URL if editable */}
                                          {/* <div> <label htmlFor="editStudentPhotoURL" className="block text-xs font-medium text-gray-700 mb-0.5">Student Photo URL</label> <input type="text" id="editStudentPhotoURL" name="placedStudentPhotoURL" value={editData.placedStudentPhotoURL || ''} onChange={handleEditInputChange} className={inputStyle} /> </div> */}
                                          {/* <div> <label htmlFor="editCompanyLogoURL" className="block text-xs font-medium text-gray-700 mb-0.5">Company Logo URL</label> <input type="text" id="editCompanyLogoURL" name="companyLogoURL" value={editData.companyLogoURL || ''} onChange={handleEditInputChange} className={inputStyle} /> </div> */}
                                     </div>
                                 </fieldset>

                                 {/* Key Skills Input */}
                                 <div>
                                      <label htmlFor="editSkillsInput" className="block text-sm font-medium text-gray-700 mb-1">Key Skills (Comma-separated)</label>
                                      {/* Bind to editData.skills, handle as string */}
                                      <input type="text" id="editSkillsInput" name="skills" value={typeof editData.skills === 'string' ? editData.skills : (editData.skills || []).join(', ')} onChange={handleEditSkillsChange} className={inputStyle} placeholder="e.g., React, Node.js, AWS" />
                                 </div>

                                 {/* Job Description Textarea */}
                                 <div>
                                      <label htmlFor="editJobDescription" className="block text-sm font-medium text-gray-700 mb-1">Role Description</label>
                                      <textarea id="editJobDescription" name="jobDescription" ref={editJobDescRef} value={editData.jobDescription || ''} onChange={handleEditInputChange} className={inputStyle + " min-h-[60px]"} rows={2} /> {/* Added min-height */}
                                 </div>

                                 {/* Experience/Advice Textarea (Required) */}
                                 <div>
                                      <label htmlFor="editText" className="block text-sm font-medium text-gray-700 mb-1">Experience/Advice <span className="text-red-600">*</span></label>
                                      <textarea id="editText" name="text" ref={editTextAreaRef} value={editData.text || ''} onChange={handleEditInputChange} className={inputStyle + " min-h-[100px]"} rows={4} required /> {/* Added min-height */}
                                 </div>

                                 {/* Personal Message Textarea */}
                                 <div>
                                      <label htmlFor="editPersonalMessage" className="block text-sm font-medium text-gray-700 mb-1">Personal Message</label>
                                      <textarea id="editPersonalMessage" name="personalMessage" ref={editPersonalMsgRef} value={editData.personalMessage || ''} onChange={handleEditInputChange} className={inputStyle + " min-h-[60px]"} rows={2} /> {/* Added min-height */}
                                 </div>

                                 {/* Error/Success Display for Save Action */}
                                 <div className='min-h-[40px] pt-1'>
                                      {updateError && ( /* Use updateError for save failures */
                                           <p className='text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200'>
                                                Error: {updateError}
                                           </p>
                                      )}
                                      {successMessage && (
                                           <p className='text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200'>
                                                {successMessage}
                                           </p>
                                      )}
                                 </div>

                                 {/* Edit Form Actions (Save/Cancel) */}
                                 <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                      <button type="button" onClick={toggleEditMode} className={cancelButtonStyle} disabled={isUpdatingAchievement}>
                                           Cancel {/* Goes back to view mode */}
                                      </button>
                                      <button type="submit" className={saveButtonStyle} disabled={isUpdatingAchievement}>
                                           {isUpdatingAchievement ? 'Saving...' : <><Save size={16} className="mr-1"/> Save Changes</>}
                                      </button>
                                 </div>
                            </form>

                         ) : (
                            /* --- VIEW DETAILS (Inline JSX) --- */
                            <div className="space-y-4"> {/* Container for view mode details */}

                                 {/* Display Full Achievement Details */}
                                 <div className="bg-white p-0 rounded-lg space-y-4"> {/* Removed card padding as it's in modal */}

                                     {/* Basic Info: Name, Role, Company, Year, Branch */}
                                     <div>
                                          <h3 className="text-xl font-bold text-gray-900 leading-tight">
                                               {selectedAchievement.placedStudentName || 'Student'}
                                          </h3>
                                          <p className="text-lg text-gray-700 mt-0.5">
                                              {selectedAchievement.roleTitle || 'Placement'} at {selectedAchievement.companyName || 'Company'}
                                          </p>
                                          {(selectedAchievement.placedStudentBranch || selectedAchievement.placedStudentYear) && (
                                               <p className="text-sm text-gray-500 mt-0.5">
                                                   {selectedAchievement.placedStudentBranch && selectedAchievement.placedStudentBranch}{selectedAchievement.placedStudentBranch && selectedAchievement.placedStudentYear ? ' • ' : ''}{selectedAchievement.placedStudentYear && selectedAchievement.placedStudentYear}
                                               </p>
                                          )}
                                     </div>

                                      {/* Image (if exists, using Data URL for now) */}
                                      {/* Use placedStudentPhotoURL if that's the field */}
                                     {(selectedAchievement.placedStudentPhotoURL || selectedAchievement.companyLogoURL) && (
                                          <div className="flex justify-center gap-4 items-center flex-wrap"> {/* Layout images side-by-side */}
                                             {selectedAchievement.placedStudentPhotoURL && ( // Assuming photoURL is stored
                                                  // Add basic image styling and alt text
                                                  <img
                                                      src={selectedAchievement.placedStudentPhotoURL}
                                                      alt={`Photo of ${selectedAchievement.placedStudentName}`}
                                                      className="max-w-[48%] h-auto max-h-40 object-contain rounded-md border border-gray-200"
                                                  />
                                              )}
                                              {selectedAchievement.companyLogoURL && ( // Assuming companyLogoURL is stored
                                                  // Add basic image styling and alt text
                                                  <img
                                                      src={selectedAchievement.companyLogoURL}
                                                      alt={`${selectedAchievement.companyName} Logo`}
                                                      className="max-w-[48%] h-auto max-h-20 object-contain rounded-md"
                                                  />
                                              )}
                                         </div>
                                     )}


                                     {/* Text/Personal Message sections */}
                                     {selectedAchievement.text && (
                                         <section aria-labelledby="achievement-text">
                                             <h4 id="achievement-text" className="text-md font-semibold text-gray-800 mb-1 border-b pb-1">Experience / Advice</h4>
                                             {/* Use ReactMarkdown if desired, otherwise render plain text */}
                                             {/* Assuming ReactMarkdown is *not* needed for these simple text fields based on previous code */}
                                             <p className="text-sm whitespace-pre-wrap text-gray-700">{selectedAchievement.text}</p>
                                         </section>
                                     )}
                                      {selectedAchievement.personalMessage && (
                                         <section aria-labelledby="achievement-personal-message">
                                             <h4 id="achievement-personal-message" className="text-md font-semibold text-gray-800 mb-1 border-b pb-1">Personal Note</h4>
                                             <p className="text-sm italic whitespace-pre-wrap text-gray-600">"{selectedAchievement.personalMessage}"</p>
                                         </section>
                                     )}


                                     {/* Other Details (Skills, Location, Salary, Job Description, Placement Type) */}
                                      <section aria-labelledby="achievement-details-view" className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-5 border-t border-gray-100 text-sm">
                                          <h4 id="achievement-details-view" className="sr-only">Key Details</h4> {/* Screen reader only heading */}

                                          {selectedAchievement.skills && selectedAchievement.skills.length > 0 && (
                                              <div className="space-y-1">
                                                   <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Skills</h5>
                                                   <div className='flex flex-wrap gap-1.5'>{selectedAchievement.skills.map(s => <span key={s} className='text-xs bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-gray-700 font-medium'>{s}</span>)}</div>
                                              </div>
                                          )}
                                          {selectedAchievement.location && (
                                              <div className="space-y-1">
                                                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</h5>
                                                  <p className="text-sm text-gray-800">{selectedAchievement.location}</p>
                                              </div>
                                          )}
                                           {selectedAchievement.salary && (
                                              <div className="space-y-1">
                                                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Salary/Package</h5>
                                                  <p className="text-sm text-gray-800">{selectedAchievement.salary}</p>
                                              </div>
                                          )}
                                          {selectedAchievement.placementType && (
                                               <div className="space-y-1">
                                                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</h5>
                                                  <p className="text-sm text-gray-800">{selectedAchievement.placementType}</p>
                                              </div>
                                          )}
                                          {selectedAchievement.jobDescription && (
                                               <div className="space-y-1 sm:col-span-2"> {/* Span two columns on small screens */}
                                                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Description</h5>
                                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedAchievement.jobDescription}</p> {/* Use pre-wrap for line breaks */}
                                              </div>
                                          )}
                                      </section>

                                      {/* Creation Timestamp */}
                                      {selectedAchievement.createdAt && (
                                           <p className="text-xs text-gray-500 pt-3 border-t mt-4">
                                               Posted by {selectedAchievement.creatorName || 'Unknown'} on {formatSimpleDate(selectedAchievement.createdAt)}
                                           </p>
                                      )}

                                 </div> {/* End View Details content */}


                                 {/* Edit and Delete Buttons (Visible only to the creator when viewing) */}
                                 {/* Check if AuthContext is *not* loading AND user exists AND user ID matches creatorId */}
                                 {/* Use isUpdatingAchievement state for disabling during both save and delete */}
                                 {!isLoading && currentUser?.uid === selectedAchievement.creatorId && (
                                     <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-5">
                                         <button
                                             type="button"
                                             onClick={toggleEditMode} // Switch to edit mode
                                             className={editButtonStyle}
                                             disabled={isUpdatingAchievement || isDeletingAchievement} // Disable if any action is in progress
                                         >
                                              <Pencil size={16}/> Edit
                                         </button>
                                         <button
                                             type="button"
                                             onClick={handleDeleteAchievement} // Trigger delete handler
                                             className={deleteButtonStyle}
                                              disabled={isUpdatingAchievement || isDeletingAchievement} // Disable if any action is in progress
                                         >
                                             {isDeletingAchievement ? 'Deleting...' : <><Trash2 size={16}/> Delete</>}
                                         </button>
                                     </div>
                                 )}

                                 {/* Display Update/Delete Errors or Loading Spinner in View Mode */}
                                 {/* Use updateError for save/general errors, check isDeletingAchievement for delete loading */}
                                  {(updateError || isDeletingAchievement) && (
                                      <div className='text-sm text-red-600 mt-2 text-center'>
                                          {isDeletingAchievement ? ( // Show spinner during delete
                                               <>
                                                  <svg className="animate-spin h-5 w-5 mx-auto text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                                                  Deleting...
                                               </>
                                          ) : (
                                              // Show save/other errors if not currently deleting
                                              <p className='p-2 bg-red-50 border border-red-200 rounded'>Error: {updateError}</p>
                                          )}
                                      </div>
                                  )}

                                 {/* Optional: Comments Section for Achievement Details */}
                                 {/* If you want comments on achievements, render a component here */}
                                 {/* Example: <AchievementComments achievementId={selectedAchievement.id} currentUser={currentUser} /> */}


                             </div>
                         )}
                     </div>

                 ) : (
                     // --- No Achievement Selected / Loading State within Modal ---
                     // This state should ideally only show briefly if data isn't ready on click
                     // The parent page handles the primary loading state for the feed list
                     <div className="p-6 text-center text-gray-500 italic">
                        {/* Check if the feed list itself is loading (shouldn't happen if modal is open from clicked card) */}
                         {/* If selectedAchievement becomes null *after* modal is open due to error, show error message */}
                         {updateError ? (
                             <p className='text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200'>Error loading details: {updateError}</p>
                         ) : (
                             "No achievement data available." // Default message if selectedAchievement is null
                         )}
                     </div>
                 )}
            </Modal>

        </div> // End Feed Container
    ); // End return
};

export default PlacedStudentFeed;