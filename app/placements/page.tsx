// app/placements/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// Import necessary types
import { PlacementDrive, PlacementStatus, StudentAchievement, PlacementUpdate } from '@/lib/types/placement';
// --- Use the Auth Context Hook ---
// Ensure path is correct relative to this file's location
import { useAuth } from '@/context/AuthContext';
// No longer need direct firebase/auth imports for state if using context
// import { User, getIdToken } from 'firebase/auth';

// Import Child Components (ensure paths are correct)
import PlacementFilters from '@/components/PlacementFilters';
import PlacementCard from '@/components/PlacementCard';
import PlacementDetailView from '@/components/PlacementDetailView';
import PlacedStudentFeed from '@/components/PlacedStudentFeed';
import PlacementChatSidebar from '@/components/PlacementChatSidebar';
// Import Modal if still used for delete confirmation
import Modal from '@/components/Modal'; // Adjust path if needed

// Import Icons (using lucide-react as seen in your previous code)
import { Star, Plus, ArrowLeft } from 'lucide-react';

// --- Define types for drive view state ---
// Includes 'all', 'interested' (favorites), and 'myDrives' (placeholder for future)
type PlacementDriveView = 'all' | 'interested' | 'myDrives';

// --- Main Placements Hub Page Component ---
export default function PlacementsPage() {
    // --- Get Auth state from Context ---
    // isLoading combines auth and profile loading state
    const { currentUser, isLoading, userProfile, userRole } = useAuth();
    const router = useRouter(); // Initialize router for navigation

    // --- Log Auth State (for debugging) ---
    // console.log("PlacementsPage Render - isLoading:", isLoading, "currentUser:", currentUser ? currentUser.uid : null);

    // --- State ---
    // Data States
    const [drives, setDrives] = useState<PlacementDrive[]>([]); // Holds all fetched drives based on view
    const [displayedDrives, setDisplayedDrives] = useState<PlacementDrive[]>([]); // Holds drives after client-side filtering
    const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null); // The drive currently selected for detail view
    const [selectedDriveUpdates, setSelectedDriveUpdates] = useState<PlacementUpdate[]>([]); // Updates for the selected drive

    // Loading & Error States
    const [isLoadingDrives, setIsLoadingDrives] = useState(true); // For the list fetch itself
    const [isLoadingDetailData, setIsLoadingDetailData] = useState(false); // For fetching specific drive details & updates
    const [driveError, setDriveError] = useState<string | null>(null); // Error for the list fetch
    const [detailError, setDetailDataError] = useState<string | null>(null); // Error for the detail fetch

    // Filter & View State
    const [activeDriveView, setActiveDriveView] = useState<PlacementDriveView>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<PlacementStatus | 'All'>('All');
    const [companyFilter, setCompanyFilter] = useState<string>('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [branchFilter, setBranchFilter] = useState<string>('');

    // Favorites State (Interested Drives)
    const [interestedDrives, setInterestedDrives] = useState<string[]>([]);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeletingDrive, setIsDeletingDrive] = useState(false);
    const [deleteDriveError, setDeleteDriveError] = useState<string | null>(null);
    const [driveToDelete, setDriveToDelete] = useState<PlacementDrive | null>(null);

    // Chat Sidebar State
    const [isChatOpen, setIsChatOpen] = useState(false);

    // --- Derived State: Ownership ---
    // Memoize the ownership check as it depends on state/context
    const isSelectedDriveOwner = useMemo(() => {
        // Check isLoading first. If still loading, can't determine ownership reliably.
        return !isLoading && !!currentUser && !!selectedDrive && currentUser.uid === selectedDrive.postedById;
    }, [isLoading, currentUser, selectedDrive]);


    // --- Handlers (Declared using useCallback - moved BEFORE effects) ---

    // Handler for clicking on a PlacementCard to view details
    const handleSelectDrive = useCallback((drive: PlacementDrive) => {
        // Only update if a different drive is selected
        if (selectedDrive?.id !== drive.id) {
            console.log("Selected drive:", drive.id);
            setSelectedDrive(drive);
            setIsChatOpen(false); // Close chat sidebar when a new drive is selected
        }
    }, [selectedDrive?.id]); // Only re-create if selectedDrive.id changes - used in render JSX

    // Handler for the "Back to List" button/action
    // Used by the "Back" button in the detail view and potentially other effects
    const handleBackToList = useCallback(() => {
        console.log("Returning to list view.");
        setSelectedDrive(null); // Clear the selected drive to show the list
        setIsChatOpen(false); // Close chat sidebar
        setSelectedDriveUpdates([]); // Clear updates state
        setDetailDataError(null); // Clear any previous detail errors
    }, []); // This handler has no external dependencies besides stable setters, so empty array is correct.

     // Handler for toggling a drive's 'interested' status (client-side storage)
     // Used by the star icon on PlacementCard
     const toggleInterestedDrive = useCallback((driveId: string) => {
         console.log(`Toggling interest for drive ID: ${driveId}`);
         // Require user login to toggle interest
         if (!driveId || !currentUser) {
             alert("Please log in to mark drives as interested.");
             return;
         }
         const isFav = interestedDrives.includes(driveId); // Check if already in the list
         // Create the updated list
         const updated = isFav
             ? interestedDrives.filter(id => id !== driveId) // Remove if already favorited
             : [...interestedDrives, driveId]; // Add if not favorited

         setInterestedDrives(updated); // Update state
         console.log("Updated interested drives:", updated);

         // Update localStorage (synchronous, can potentially cause performance issues with large data)
         try {
             localStorage.setItem('skillNexusPlacementInterested', JSON.stringify(updated));
         } catch (error) {
             console.error("LocalStorage Error saving interested drives:", error);
             // Optionally revert state if localStorage fails (user experience might vary)
             // setInterestedDrives(interestedDrives);
             alert("Failed to save interest status.");
         }
     }, [interestedDrives, currentUser]); // Depend on current list and user

    // Handler to initiate the delete process (show modal)
    // Used by the delete button in PlacementDriveBanner
    const requestDeleteDrive = useCallback(() => {
        // Only allowed if the user is the owner and a drive is selected
        if (!isSelectedDriveOwner || !selectedDrive) {
            console.warn("Delete request denied: Not owner or no drive selected.");
            return;
        }
        console.log("Requesting delete for drive:", selectedDrive.id);
        setDriveToDelete(selectedDrive); // Set the drive to be deleted
        setDeleteDriveError(null); // Clear previous delete errors
        setShowDeleteModal(true); // Show the confirmation modal
    }, [isSelectedDriveOwner, selectedDrive]); // Depend on ownership and selected drive

    // Handler to confirm and perform the actual delete API call
    // Used by the "Delete" button in the delete confirmation modal
    const confirmDeleteDrive = useCallback(async () => {
        // Double-check permissions and data before proceeding
        if (!isSelectedDriveOwner || !currentUser || !driveToDelete?.id) {
            console.warn("Delete confirmation denied: Missing permissions or drive data.");
            setDeleteDriveError("Cannot delete: Authentication or data missing.");
            return;
        }

        console.log("Confirming delete for drive ID:", driveToDelete.id);

        setIsDeletingDrive(true); // Set loading state for the delete action
        setDeleteDriveError(null); // Clear previous error

        try {
            // Get a fresh auth token
            // Use currentUser.getIdToken(true) from AuthContext's user object
            const idToken = await currentUser.getIdToken(true); // Get a fresh token
            // Make the DELETE API call
            const response = await fetch(`/api/placement/drives/${driveToDelete.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${idToken}` }
            });

            if (!response.ok) {
                // Attempt to parse error from response body
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Delete failed (${response.status})`);
            }

            console.log(`Drive ${driveToDelete.id} deleted successfully.`);

            // Close the modal and reset related state
            setShowDeleteModal(false);
            setDriveToDelete(null);

            // Return to list view and clear selected drive state
            setSelectedDrive(null); // This triggers the detail view cleanup effect
            setSelectedDriveUpdates([]);
            setDetailDataError(null);

            // Update the list of drives displayed in the list view
            setDrives(prevDrives => prevDrives.filter(d => d.id !== driveToDelete.id));
            // The filtering effect will automatically update displayedDrives

        } catch (err: any) {
            console.error("❌ Delete error:", err);
            // Set the error message to display in the modal
            setDeleteDriveError(err.message || "Could not delete placement drive.");
        } finally {
            // Always set deleting state to false
            setIsDeletingDrive(false);
        }
    }, [isSelectedDriveOwner, currentUser, driveToDelete]); // Depend on ownership, user, and the drive to delete

    // Handler to toggle the chat sidebar visibility
    // Used by the Q&A button in PlacementDriveBanner and the floating button (now removed)
    const toggleChat = useCallback(() => {
         console.log("Toggling chat sidebar.");
        setIsChatOpen(prev => !prev);
    }, []);

    // --- Button Class Helper (Declared using useCallback - moved BEFORE effects) ---
    // Memoized helper for generating button styles based on active view
    const getButtonClasses = useCallback((view: PlacementDriveView): string => {
        const base = "px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 border";
        const isActive = activeDriveView === view;

        if (isActive) {
             // Use blue for 'all', potentially different colors for 'myDrives'/'interested' if desired
             return `${base} bg-blue-600 border-blue-600 text-white shadow-sm`;
        } else {
            // Default inactive style
            return `${base} bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400`;
        }
    }, [activeDriveView]); // Depend on the active view state


    // --- Effects (Declared AFTER handlers) ---

    // Effect: Load Favorites from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('skillNexusPlacementInterested');
            if (stored) {
                const p = JSON.parse(stored);
                // Basic validation: Ensure it's an array
                if (Array.isArray(p)) {
                    setInterestedDrives(p.filter(item => typeof item === 'string')); // Filter to ensure string IDs
                } else {
                    console.warn("LocalStorage 'skillNexusPlacementInterested' was not an array. Attempting cleanup.");
                    localStorage.removeItem('skillNexusPlacementInterested'); // Clean up potentially invalid data
                }
            }
        } catch (e) {
            console.error("LS Error (Interested):", e);
             // If parsing fails, remove the bad data to prevent infinite errors
             localStorage.removeItem('skillNexusPlacementInterested');
        }
    }, []); // Empty dependency array: Runs only once on mount

    // Effect: Reset view/selected drive if user logs out
    // This effect runs whenever the `isLoading` or `currentUser` state changes (from AuthContext)
    useEffect(() => {
        // Only run this check *after* the context has finished loading
        if (!isLoading) {
            // If user logs out while on 'myDrives' or 'interested' view, switch to 'all'
            if (!currentUser && (activeDriveView === 'myDrives' || activeDriveView === 'interested')) {
                console.log("User logged out, switching view to 'all'");
                setActiveDriveView('all'); // This state change will trigger fetchDrives
            }
            // If user logs out while viewing a specific drive, go back to list
             if (!currentUser && selectedDrive) {
                 console.log("User logged out while viewing drive, returning to list");
                 // Use the declared handler to clear selected drive state
                 handleBackToList();
             }
        }
    }, [isLoading, currentUser, activeDriveView, selectedDrive, handleBackToList]); // Depend on states and the handler


    // Effect: Fetch Placement Drives based on View and Filters (handled server-side where possible)
    // Memoize the fetch function as it has dependencies
    const fetchDrives = useCallback(async () => {
        // Wait until the main context loading is finished before fetching
        // This prevents fetching before we know if user is logged in,
        // which affects 'myDrives' and visibility of 'interested'.
        if (isLoading) {
            console.log("fetchDrives: Waiting for auth context to load...");
            return; // Don't fetch if auth state isn't resolved yet
        }

        // If the view is 'myDrives' and there's no user, clear the list and show message.
         if (activeDriveView === 'myDrives' && !currentUser) {
             console.log("fetchDrives: 'myDrives' view selected, but no user. Clearing drives.");
             setDrives([]); // Clear the list
             setIsLoadingDrives(false); // Set loading to false
             setDriveError("Please log in to view your drives."); // Set auth-specific error
             return; // Stop fetching
         }

        setIsLoadingDrives(true); // Set loading state true
        setDriveError(null); // Clear previous errors
        // setDrives([]); // Consider removing this line if you want to show old data while loading new.
                       // Keeping it clears immediately, which is fine but can be jarring.
                       // Let's keep it for now as it reflects the previous version.
         setDrives([]); // Clear previous results while loading


        try {
            let url = '/api/placement/drives';
            const queryParams = new URLSearchParams();

            // Determine the 'view' parameter for the backend API
            // Send 'myDrives' if that's the active view AND user is logged in.
            // Otherwise, send 'all'. The backend ignores 'interested' as a server-side filter.
            if (activeDriveView === 'myDrives' && currentUser) {
                 queryParams.append('view', 'myDrives');
                 // Note: Filtering by status is still client-side for 'myDrives' in current API
                 // If backend supported status filter with userId, we'd add it here.
            } else {
                 queryParams.append('view', 'all');
                 // Server-side status filter applies only when view is 'all' for now
                 // We still apply client-side filtering below in another effect for 'myDrives'/'interested'
                 if (statusFilter && statusFilter !== 'All') {
                     queryParams.append('status', statusFilter);
                 }
            }

            url += `?${queryParams.toString()}`;

            const headers: HeadersInit = {};
            // Add Auth header only if requesting 'myDrives' view and user is logged in
            if (activeDriveView === 'myDrives' && currentUser) {
                 // Use getIdToken from the currentUser object provided by AuthContext
                 const idToken = await currentUser.getIdToken(true); // Get a fresh token
                 headers['Authorization'] = `Bearer ${idToken}`;
            }

            console.log("Fetching drives from:", url);

            const response = await fetch(url, { headers });

            // Check mount status before updating state (though fetch should be fast enough)
            // This pattern is more critical for long-running processes or when data changes frequently.
            // if (!mounted) { console.log("fetchDrives: Component unmounted during fetch."); return; }


            if (!response.ok) {
                 const errData = await response.json().catch(() => ({ error: `Request failed ${response.status}` }));
                 // Handle specific auth errors for 'myDrives' view
                 if ((response.status === 401 || response.status === 403) && activeDriveView === 'myDrives') {
                     console.warn("Auth failed for 'myDrives', switching to 'all'.");
                     setActiveDriveView('all'); // Switch view state
                     setDriveError(errData.error || "Authentication failed. Showing all drives."); // Show auth error message
                     // The effect triggered by setActiveView('all') will re-fetch.
                     return; // Stop current function execution
                 }
                 // Throw general error for other non-OK responses
                 throw new Error(errData.error || `Failed to fetch drives (${response.status})`);
            }

            const data = await response.json();
            console.log("Drives fetched successfully. Count:", data.drives?.length || 0);
            // Ensure data.drives is an array before setting state
            setDrives(data.drives && Array.isArray(data.drives) ? data.drives : []);

        } catch (err: any) {
            console.error("Fetch Drives Error:", err);
            setDrives([]); // Clear drives on error
            setDriveError(err.message || "Failed to load drives."); // Set descriptive error
        } finally {
            setIsLoadingDrives(false); // Always set loading to false at the end
        }
    // Dependencies: activeDriveView, currentUser, isLoading (from context), statusFilter.
    // isLoading dependency ensures fetch runs *after* auth state is known.
    }, [activeDriveView, currentUser, isLoading, statusFilter]);

    // Trigger the fetch effect when its dependencies change
    useEffect(() => {
        fetchDrives();
    }, [fetchDrives]); // Depend on the memoized fetchDrives function


    // Effect: Apply Client-Side Filters and update displayedDrives
    // This effect runs whenever the main 'drives' state changes OR
    // any client-side filter state changes OR the activeView/interestedDrives change.
    useEffect(() => {
        // console.log("Applying client-side filters...");
        let filtered = [...drives]; // Start with the currently fetched drives (from fetchDrives effect)

        // 1. Apply 'interested' view filter (client-side)
        if (activeDriveView === 'interested') {
            filtered = filtered.filter(d => d.id && interestedDrives.includes(d.id));
        }
         // 2. Apply 'myDrives' view filter (client-side - backend currently handles this, but kept here for robustness)
        // if (activeDriveView === 'myDrives' && currentUser) {
        //     filtered = filtered.filter(d => d.postedById === currentUser.uid);
        // }


        // 3. Apply specific filters (search term, company, role, branch, status - client-side)
        // Status filter is applied here for 'myDrives' and 'interested' views,
        // as the server filter only works when view='all'. Applying it here covers all views.
        if (statusFilter !== 'All') {
             filtered = filtered.filter(d => d.status === statusFilter);
        }
        if (companyFilter.trim()) {
             const l = companyFilter.trim().toLowerCase();
             filtered = filtered.filter(d => d.companyName?.toLowerCase().includes(l));
        }
        if (roleFilter.trim()) {
             const l = roleFilter.trim().toLowerCase();
             filtered = filtered.filter(d => d.roleTitle?.toLowerCase().includes(l));
        }
        if (branchFilter.trim()) {
             const l = branchFilter.trim().toLowerCase();
             filtered = filtered.filter(d => d.eligibleBranches?.some(b => b.toLowerCase().includes(l)));
        }
         // Search term filters across multiple fields
        if (searchTerm.trim()) {
            const l = searchTerm.trim().toLowerCase();
            filtered = filtered.filter(d =>
                (d.companyName?.toLowerCase().includes(l) ||
                 d.roleTitle?.toLowerCase().includes(l) ||
                 d.description?.toLowerCase().includes(l) ||
                 d.eligibilityCriteria?.toLowerCase().includes(l) ||
                 d.location?.toLowerCase().includes(l) ||
                 d.eligibleBranches?.some(b => b.toLowerCase().includes(l))) // Check branches again if not covered by branchFilter
            );
        }


        // Update the state that controls what is actually displayed
        setDisplayedDrives(filtered);

    }, [drives, activeDriveView, interestedDrives, searchTerm, statusFilter, companyFilter, roleFilter, branchFilter]); // Depend on states that affect filtering


    // Effect: Fetch Details and Updates for the Selected Drive
    // This effect runs whenever the selectedDrive state changes (specifically its ID)
    // or when the auth context loading state changes (to ensure fetch happens after auth).
     useEffect(() => {
         // If no drive is selected or auth context is still loading, clear detail data and stop.
         // console.log(`Detail Effect Triggered. selectedDrive ID: ${selectedDrive?.id}, isLoading: ${isLoading}`);
         if (!selectedDrive?.id || isLoading) {
             // console.log("Detail Effect: No selected drive ID or auth loading. Clearing details.");
             setSelectedDriveUpdates([]);
             setIsLoadingDetailData(false);
             setDetailDataError(null);
             return;
         }

         let mounted = true; // Flag to prevent state updates if component unmounts
         const driveIdToFetch = selectedDrive.id; // Capture ID for fetch calls

         console.log(`Detail Effect: Fetching details for drive ID: ${driveIdToFetch}`);

         setIsLoadingDetailData(true); // Set loading state true
         setDetailDataError(null); // Clear previous errors
         setSelectedDriveUpdates([]); // Clear previous updates

         async function loadDetailData() {
            try {
                // Prepare headers with auth token if user is logged in
                const headers: HeadersInit = {};
                if (currentUser) {
                    // Use getIdToken from the currentUser object
                    const idToken = await currentUser.getIdToken(true); // Get a fresh token
                    headers['Authorization'] = `Bearer ${idToken}`;
                }
                console.log("Fetching drive details and updates...");
                 // Use Promise.all to fetch details and updates concurrently
                 const [detailRes, updatesRes] = await Promise.all([
                     fetch(`/api/placement/drives/${driveIdToFetch}`), // Fetch drive details
                     fetch(`/api/placement/drives/${driveIdToFetch}/updates`, { headers }) // Fetch drive updates (may require auth for owner/admin)
                 ]);

                // Check mount status before updating state
                if (!mounted) { console.log("Detail Effect: Component unmounted, aborting state updates."); return; }

                let fetchedDriveData: PlacementDrive | null = null;

                // Handle Drive Details Response
                if (!detailRes.ok) {
                    // Handle 404 specifically (drive might have been deleted by someone else)
                    if (detailRes.status === 404) { throw new Error("Placement drive not found or has been deleted."); }
                    // Handle other non-OK responses
                    const errData = await detailRes.json().catch(() => ({})); // Attempt to parse error body
                    throw new Error(errData.error || `Failed to fetch drive details (${detailRes.status})`);
                }
                const detailJson = await detailRes.json();
                if (!detailJson.drive) { // Check for the expected structure { drive: {...} }
                     throw new Error("Invalid drive detail format received from API.");
                }
                fetchedDriveData = detailJson.drive;
                console.log("Drive detail fetched:", fetchedDriveData.companyName);


                // Handle Drive Updates Response
                let fetchedUpdates: PlacementUpdate[] = [];
                if (!updatesRes.ok) {
                    console.error(`Updates fetch failed (${updatesRes.status})`);
                    // Decide if updates failing should error out the whole detail view
                    // For now, just log and proceed without updates.
                     console.warn(`Could not fetch updates for drive ${driveIdToFetch}. Status: ${updatesRes.status}`);
                } else {
                    const updatesJson = await updatesRes.json();
                    // Check for the expected structure { updates: [...] } and if it's an array
                    if (updatesJson.updates && Array.isArray(updatesJson.updates)) {
                         fetchedUpdates = updatesJson.updates;
                         console.log(`Updates fetched successfully. Count: ${fetchedUpdates.length}`);
                    } else {
                         console.warn("Invalid updates format received from API.");
                    }
                }

                // Update state only if component is still mounted and fetched data matches selected ID
                if (mounted && fetchedDriveData && fetchedDriveData.id === driveIdToFetch) {
                     // Update the selected drive state with potentially more complete data from the API
                     // This might overwrite some properties (like timestamps) with more accurate ones after fetch
                     setSelectedDrive(fetchedDriveData);
                     // Set the fetched updates
                     setSelectedDriveUpdates(fetchedUpdates);
                 } else if (mounted && fetchedDriveData && fetchedDriveData.id !== driveIdToFetch) {
                     console.warn("Detail Effect: Fetched data ID mismatch. Ignoring stale data.");
                 }


            } catch (err: any) {
                // Handle any errors during fetch or processing
                console.error("Error loading placement drive details:", err);
                if (mounted) {
                     setDetailDataError(err.message || "Error loading details.");
                     // Clear selected drive and updates on error
                     setSelectedDrive(null); // This will trigger the handleBackToList behavior visually/logically
                     setSelectedDriveUpdates([]); // Clear updates
                 }
            } finally {
                // Always set loading to false at the end
                if (mounted) {
                    setIsLoadingDetailData(false);
                     console.log("Detail Effect: Loading finished.");
                }
            }
        }

         // Call the async function to start loading data
         loadDetailData();

         // Cleanup function: Set mounted to false when component unmounts or effect re-runs
         return () => { mounted = false; console.log("Detail Effect: Cleanup - Setting mounted to false."); };

     }, [selectedDrive?.id, isLoading, currentUser]); // Dependencies: selectedDrive ID, context loading state, current user for auth header


    // --- Render Loading State for Auth Context ---
    // Show a global loader while the AuthContext is initializing or checking user status
    if (isLoading) {
        console.log("PlacementsPage Render - Showing Auth Loading State");
        return (
             <div className="flex flex-col items-center justify-center min-h-screen text-center text-gray-600">
                 <svg className="animate-spin h-8 w-8 mb-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                 Loading user state...
             </div>
         );
    }

    // --- Main Render ---
    return (
        // Main container - Adjust height to account for Navbar height (assumed pt-16 on inner content)
        // Use h-[calc(100vh-4rem)] if Navbar is fixed with height 4rem (64px) and no padding on this container
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-gray-100 relative overflow-hidden">

            {/* Left Pane (Main Content Area - List or Detail) */}
            {/* Adjusted width based on selectedDrive and isChatOpen state */}
             <div className={`h-full overflow-y-auto border-r border-gray-200 bg-white transition-all duration-300 ease-in-out
                 ${ selectedDrive ?
                     // If a drive is selected, take full width on mobile, and a controlled width on md+
                     // Width on md+ shrinks if chat is open
                    (isChatOpen ? 'w-full md:w-[calc(100%-20rem)] lg:w-[calc(100%-24rem)] xl:w-[calc(100%-28rem)]' : 'w-full md:w-2/3')
                 :
                     // If no drive is selected (list view), take full width on mobile, 2/3 on md+
                     'w-full md:w-2/3'
                 }
             `}>
                 {/* Inner Padding */}
                 {/* Apply padding here, including top padding to offset the fixed Navbar content if needed */}
                 {/* If using pt-16 on the main container in layout.tsx, no pt here needed. */}
                 {/* If Navbar is fixed and content starts right below, this padding is crucial. */}
                 <div className="p-4 sm:p-6 lg:p-8 min-h-full pt-6"> {/* Added pt-6 back based on likely layout need */}
                     {/* Header Row */}
                     <div className="mb-6 flex justify-between items-center flex-wrap gap-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate pr-2">
                            {/* Dynamically show title based on state */}
                            {selectedDrive && !isLoadingDetailData ? selectedDrive.companyName : (!selectedDrive ? "Placement Opportunities" : "Loading...")}
                        </h1>
                        {/* Conditional "Add Drive" or "Back" Button */}
                        {/* Show "Add Drive" button only in list view and if user is logged in (and AuthContext is done loading) */}
                        {!selectedDrive && !isLoading && currentUser && (
                            <Link href="/placements/create" legacyBehavior>
                                <a className="inline-flex items-center gap-1.5 bg-blue-600 text-white font-medium py-1.5 px-4 rounded-md text-sm hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm flex-shrink-0">
                                    <Plus size={18} className="-ml-1" /> Add Drive
                                </a>
                            </Link>
                         )}
                         {/* Show "Back" button only in detail view */}
                        {selectedDrive && (
                            <button onClick={handleBackToList} className="flex items-center text-sm text-blue-600 hover:underline font-medium flex-shrink-0">
                                <ArrowLeft size={16} className="mr-1" /> Back
                            </button>
                        )}
                     </div>

                    {/* Dynamic Content Area: Render List OR Detail */}
                    {selectedDrive ? (
                         // --- RENDER DETAIL VIEW (Corrected section) ---
                         <>
                           {/* Show loading spinner while fetching detail data */}
                           {isLoadingDetailData && (
                             <div className="flex justify-center items-center text-gray-500 py-20">
                                 <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                                 Loading details...
                             </div>
                           )}
                           {detailError && (
                             <div className="text-center py-10 text-red-600 bg-red-50 border border-red-200 p-4 rounded-md">
                                 Error: {detailError}
                                 {/* Provide a way to go back to the list */}
                                 <button onClick={handleBackToList} className="ml-2 text-sm text-blue-700 hover:underline font-medium">
                                     Return to List
                                 </button>
                             </div>
                           )}
                           {/* Render the detail view component only when not loading, no error, and a drive object exists */}
                           {/* Ensure selectedDrive is truthy AND has an ID before rendering the component */}
                           {!isLoadingDetailData && !detailError && selectedDrive?.id && (
                               <PlacementDetailView
                                   drive={selectedDrive} // Pass the selected drive data
                                   onBack={handleBackToList} // Pass the back handler
                                   isOwner={isSelectedDriveOwner} // Pass ownership status
                                   onDeleteRequest={requestDeleteDrive} // Pass delete modal trigger handler
                                   initialUpdates={selectedDriveUpdates} // Pass the fetched updates
                                   currentUser={currentUser} // Pass the current user (needed for posting updates)
                                   onToggleChat={toggleChat} // Pass the chat toggle handler (for the banner button)
                                   // Note: PlacementDetailView component in the provided code does NOT accept isLoading prop.
                                   // isLoading={isLoadingDetailData} // Pass loading state if DetailView component was modified to use it
                               />
                           )}
                         </>

                    ) : (
                        // --- RENDER DRIVE LIST VIEW ---
                        <>
                            {/* Filter/View Bar - Sticky */}
                            {/* Adjusted top to account for the pt-6 on the inner div */}
                            <div className="sticky top-[-24px] z-10 bg-white/95 backdrop-blur-sm py-3 mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-200">
                                 {/* Drive View Toggles (All, My Drives, Interested) */}
                                 <div className="flex flex-wrap gap-2 mb-3 justify-center md:justify-start">
                                     {/* --- getButtonClasses used here --- */}
                                     <button onClick={() => setActiveDriveView('all')} className={getButtonClasses('all')}> Explore All </button>
                                     {/* Show 'My Drives' and 'Interested' buttons only if user is logged in (and AuthContext is done loading) */}
                                     {!isLoading && currentUser && (
                                         <button onClick={() => setActiveDriveView('myDrives')} className={getButtonClasses('myDrives')}> My Drives </button>
                                     )}
                                     {!isLoading && currentUser && (
                                         <button onClick={() => setActiveDriveView('interested')} className={getButtonClasses('interested')}> <Star size={14} className="mr-0.5 -ml-0.5" /> Interested </button>
                                     )}
                                     {/* Optional: Message if auth required for filters */}
                                     {!isLoading && !currentUser && (
                                         <span className="text-xs text-gray-500 italic self-center">(Log in to see My Drives / Interested)</span>
                                     )}
                                 </div>
                                 {/* Placement Filters Component */}
                                 <PlacementFilters
                                     searchTerm={searchTerm} onSearchChange={setSearchTerm}
                                     statusFilter={statusFilter} onStatusChange={setStatusFilter}
                                     companyFilter={companyFilter} onCompanyChange={setCompanyFilter}
                                     roleFilter={roleFilter} onRoleChange={setRoleFilter}
                                     branchFilter={branchFilter} onBranchChange={setBranchFilter}
                                 />
                            </div>

                             {/* Drive List Display Area */}
                             {/* Show loading, error, or empty messages based on state */}
                              {isLoadingDrives && (
                                 <div className="text-center py-10 text-gray-500">
                                     <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                                     Loading drives...
                                 </div>
                              )}
                              {driveError && !isLoadingDrives && (
                                  <div className="text-center text-red-600 bg-red-50 border border-red-200 p-4 rounded-md py-10">
                                      Error loading drives: {driveError}
                                      {/* Option to switch to 'all' view if 'myDrives' auth failed */}
                                      {driveError.includes("Authentication failed") && activeDriveView !== 'all' && (
                                          <button onClick={() => setActiveDriveView('all')} className="ml-2 text-sm text-blue-700 hover:underline font-medium">Show All Drives</button>
                                      )}
                                  </div>
                              )}
                              {/* Show empty state message if no drives match criteria */}
                              {!isLoadingDrives && !driveError && displayedDrives.length === 0 && (
                                 <p className="text-gray-500 text-center py-10 italic">
                                     {/* Specific messages based on the current view */}
                                     {activeDriveView === 'myDrives' ? (currentUser ? "You haven't posted any drives yet." : "Please log in to view your drives.") :
                                      activeDriveView === 'interested' ? (currentUser ? "You haven't marked any drives as interested." : "Please log in to see interested drives.") :
                                      (searchTerm.trim() || statusFilter !== 'All' || companyFilter.trim() || roleFilter.trim() || branchFilter.trim() ? "No drives match your filters." : "No placement drives available.")}
                                 </p>
                              )}
                              {/* Render the grid of cards if drives are loaded and available */}
                              {!isLoadingDrives && !driveError && displayedDrives.length > 0 && (
                                 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                                     {displayedDrives.map(drive => (
                                         <div key={drive.id}
                                              onClick={() => handleSelectDrive(drive)} // Handle card click
                                              className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl"
                                              role="button"
                                              tabIndex={0}
                                              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectDrive(drive)}
                                          >
                                             {/* Render the PlacementCard component */}
                                             <PlacementCard
                                                drive={drive}
                                                isFavorite={drive.id ? interestedDrives.includes(drive.id) : false} // Check if drive is in interested list
                                                onToggleFavorite={toggleInterestedDrive} // Pass handler for the star button
                                             />
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </>
                    )}
                 </div> {/* End Left Pane Inner Padding */}
            </div> {/* End Left Pane */}

            {/* Right Pane (Placed Student Feed) */}
            {/* Width changes based on isChatOpen state */}
             <div className={`h-full overflow-y-auto bg-gray-50 transition-all duration-300 ease-in-out
                 ${selectedDrive && isChatOpen
                    ? 'w-0 hidden' // Hide right pane entirely when drive is selected AND chat is open
                    : 'w-full md:w-1/3' // Show full width on mobile, 1/3 on md+ otherwise
                 }
             `}>
                 {/* Inner Padding */}
                 {/* PlacedStudentFeed fetches its own data now, no need for initialAchievements prop */}
                 {/* Pass currentUser and isLoading from the AuthContext */}
                 <div className="p-4 sm:p-6 lg:p-8 min-h-full pt-6"> {/* Added pt-6 back */}
                      {/* Render the Placed Student Feed component */}
                      {/* PlacedStudentFeed is assumed to handle its own data fetching and loading state internally */}
                      <PlacedStudentFeed currentUser={currentUser} isLoading={isLoading} /> {/* Removed initialAchievements and error props */}
                 </div>
            </div> {/* End Right Pane */}

            {/* Chat Sidebar */}
            {/* Render sidebar only if a drive is selected and comments are enabled for it */}
            {selectedDrive && selectedDrive.commentsEnabled !== false && (
                <PlacementChatSidebar
                    driveId={selectedDrive.id!} // Pass the selected drive's ID (asserting non-null as selectedDrive is checked)
                    driveTitle={selectedDrive.companyName + ' - ' + selectedDrive.roleTitle} // Pass drive title for sidebar header
                    currentUser={currentUser} // Pass current user for posting comments
                    commentsEnabled={selectedDrive.commentsEnabled !== false} // Pass the comments enabled status
                    isOpen={isChatOpen} // Control visibility via state
                    onClose={toggleChat} // Pass handler to close the sidebar
                />
            )}

            {/* --- Removed Floating Chat Toggle Button --- */}
            {/* This button is redundant because the PlacementDriveBanner already has a Q&A button */}
            {/* and the sidebar has its own close button. */}


            {/* Delete Modal (using the generic Modal component) */}
            {showDeleteModal && driveToDelete && (
                 <Modal
                     isOpen={showDeleteModal}
                     onClose={() => { setShowDeleteModal(false); setDriveToDelete(null); setDeleteDriveError(null); }} // Close handler
                     title="Confirm Drive Deletion" // Modal title
                 >
                     <div className="space-y-4">
                         <p className="text-gray-700">
                             Are you sure you want to delete this placement drive?<br/>
                             <strong className="text-gray-900">"{driveToDelete.roleTitle} at {driveToDelete.companyName}"</strong>
                         </p>
                         <p className="text-sm text-red-600 font-medium">This action cannot be undone.</p>

                         {/* Display delete error if any */}
                         {deleteDriveError && (
                             <p className='text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200'>
                                 Error: {deleteDriveError}
                             </p>
                         )}

                         {/* Action buttons */}
                         <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
                             <button
                                 type="button"
                                 onClick={() => { setShowDeleteModal(false); setDriveToDelete(null); setDeleteDriveError(null); }}
                                 disabled={isDeletingDrive} // Disable while deleting is in progress
                                 className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                             >
                                 Cancel
                             </button>
                             <button
                                 type="button"
                                 onClick={confirmDeleteDrive} // Trigger the delete API call
                                 disabled={isDeletingDrive} // Disable while deleting is in progress
                                 className="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center min-w-[100px]"
                             >
                                 {isDeletingDrive ? ( // Show spinner and text while deleting
                                     <>
                                         <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>
                                         Deleting...
                                     </>
                                 ) : 'Delete Drive'} {/* Show standard text */}
                             </button>
                         </div>
                     </div>
                 </Modal>
             )}

         </div> // End Main Flex Container
    ); // End return
}