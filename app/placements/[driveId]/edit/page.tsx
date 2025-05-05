// app/placements/[driveId]/edit/page.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link'; // For cancel button link
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase'; // Adjust path if needed
// Import Placement types
import { PlacementDrive, PlacementStatus } from '@/lib/types/placement'; // Adjust path if needed

// Define available options for status
const placementStatusOptions: PlacementStatus[] = ['Upcoming', 'Ongoing', 'Past', 'Cancelled'];

export default function EditPlacementDrivePage() {
    const params = useParams();
    const router = useRouter(); // Get router instance
    const auth = getAuth(app);

    // --- State Variables ---
    const [initialDriveData, setInitialDriveData] = useState<PlacementDrive | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isOwner, setIsOwner] = useState<boolean>(false); // Or isAdmin if using roles
    const [authChecked, setAuthChecked] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true); // Loading initial drive data
    const [isSubmitting, setIsSubmitting] = useState(false); // Submitting changes
    const [error, setError] = useState<string | null>(null); // General/Fetch error
    const [submitError, setSubmitError] = useState<string | null>(null); // Specific submission error
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // --- Form State (Mirrors PlacementDrive fields for editing) ---
    const [companyName, setCompanyName] = useState('');
    const [companyLogoURL, setCompanyLogoURL] = useState('');
    const [roleTitle, setRoleTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eligibilityCriteria, setEligibilityCriteria] = useState('');
    const [status, setStatus] = useState<PlacementStatus>(placementStatusOptions[0]);
    // Key dates - manage as strings (YYYY-MM-DD) for input type="date"
    const [deadlineDate, setDeadlineDate] = useState('');
    const [testDate, setTestDate] = useState('');
    const [interviewDate, setInterviewDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [packageDetails, setPackageDetails] = useState('');
    const [applicationLink, setApplicationLink] = useState('');
    const [applicationInstructions, setApplicationInstructions] = useState('');
    const [location, setLocation] = useState('');
    const [eligibleBranchesInput, setEligibleBranchesInput] = useState(''); // Comma-separated input
    const [contactPerson, setContactPerson] = useState('');
    const [commentsEnabled, setCommentsEnabled] = useState(true); // Q&A toggle

    // Extract driveId safely from URL parameters
    const driveId = typeof params?.driveId === 'string' ? params.driveId : undefined;

    // Helper to format Date object or ISO string to YYYY-MM-DD for input type="date"
    const formatDateForInput = (dateInput: string | Date | undefined | null): string => {
        if (!dateInput) return '';
        try {
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput.toString());
            if (isNaN(date.getTime())) return '';
            // Format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return '';
        }
    };


    // --- Effect: Auth Listener ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true);
        });
        return () => unsubscribe();
    }, [auth]);

    // --- Effect: Fetch Initial Placement Drive Data ---
    useEffect(() => {
        // Wait for valid driveId and auth check completion
        if (!driveId || !authChecked) {
            if (!driveId && authChecked) { setError("Invalid Placement Drive ID."); setIsLoadingData(false); }
            return;
        }

        let isMounted = true;
        setIsLoadingData(true);
        setError(null); setInitialDriveData(null); setIsOwner(false); // Reset states

        async function loadDrive() {
            console.log(`Fetching drive data for edit: ${driveId}`);
            try {
                const response = await fetch(`/api/placement/drives/${driveId}`); // Use correct API endpoint
                if (!isMounted) return;

                if (response.status === 404) throw new Error("Placement drive not found.");
                if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || `API Error: ${response.status}`); }
                const data = await response.json();
                if (!data.drive) throw new Error("Invalid data format received.");
                if (!isMounted) return;

                const fetchedDrive: PlacementDrive = data.drive;
                setInitialDriveData(fetchedDrive); // Store initial data for comparison

                // --- Populate Form State ---
                setCompanyName(fetchedDrive.companyName);
                setCompanyLogoURL(fetchedDrive.companyLogoURL || '');
                setRoleTitle(fetchedDrive.roleTitle);
                setDescription(fetchedDrive.description);
                setEligibilityCriteria(fetchedDrive.eligibilityCriteria || '');
                setStatus(fetchedDrive.status);
                setDeadlineDate(formatDateForInput(fetchedDrive.keyDates?.applicationDeadline));
                setTestDate(formatDateForInput(fetchedDrive.keyDates?.testDate));
                setInterviewDate(formatDateForInput(fetchedDrive.keyDates?.interviewDate));
                setStartDate(formatDateForInput(fetchedDrive.keyDates?.startDate));
                setPackageDetails(fetchedDrive.packageDetails || '');
                setApplicationLink(fetchedDrive.applicationLink || '');
                setApplicationInstructions(fetchedDrive.applicationInstructions || '');
                setLocation(fetchedDrive.location || '');
                setEligibleBranchesInput(fetchedDrive.eligibleBranches?.join(', ') || '');
                setContactPerson(fetchedDrive.contactPerson || '');
                setCommentsEnabled(fetchedDrive.commentsEnabled !== false); // Default true

                // --- Check Ownership/Permissions ---
                // *** IMPORTANT: Replace with your actual Admin/Role check logic if needed ***
                if (user && user.uid === fetchedDrive.postedById) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                    setError(user ? "Permission Denied: You cannot edit this drive." : "Please log in to edit.");
                }
            } catch (err: any) {
                 if (isMounted) setError(err.message);
                 setIsOwner(false); // Ensure owner is false on error
            } finally {
                 if (isMounted) setIsLoadingData(false); // Stop loading
            }
        }

        // Fetch only after auth is checked
        if (authChecked) {
            loadDrive();
        }

        return () => { isMounted = false; }; // Cleanup
    }, [driveId, authChecked, user]); // Re-run if driveId, auth, or user changes


    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Check permissions and data before submitting
        if (!isOwner || !user || !initialDriveData || !driveId) {
            setSubmitError("Cannot submit: Not authorized or initial data missing."); return;
        }
        setIsSubmitting(true); setSubmitError(null); setSuccessMessage(null); // Reset feedback

        // Basic client-side validation for required fields
        if (!companyName.trim() || !roleTitle.trim() || !description.trim()) {
             setSubmitError("Company Name, Role Title, and Description are required.");
             setIsSubmitting(false); return;
        }
        const eligibleBranches = eligibleBranchesInput.split(',').map(s => s.trim()).filter(Boolean);

        // Construct keyDates object (sending strings YYYY-MM-DD or null)
         const keyDatesPayload = {
             applicationDeadline: deadlineDate || null,
             testDate: testDate || null,
             interviewDate: interviewDate || null,
             startDate: startDate || null,
         };
         // Remove null dates before comparing/sending
         Object.keys(keyDatesPayload).forEach(key => {
            if (keyDatesPayload[key as keyof typeof keyDatesPayload] === null) {
                delete keyDatesPayload[key as keyof typeof keyDatesPayload];
            }
         });
         // Format initial dates similarly for comparison
         const initialKeyDatesFormatted = {
            applicationDeadline: formatDateForInput(initialDriveData.keyDates?.applicationDeadline),
            testDate: formatDateForInput(initialDriveData.keyDates?.testDate),
            interviewDate: formatDateForInput(initialDriveData.keyDates?.interviewDate),
            startDate: formatDateForInput(initialDriveData.keyDates?.startDate),
         };
          Object.keys(initialKeyDatesFormatted).forEach(key => {
            if (!initialKeyDatesFormatted[key as keyof typeof initialKeyDatesFormatted]) {
                delete initialKeyDatesFormatted[key as keyof typeof initialKeyDatesFormatted];
            }
         });


        // Build payload with ONLY changed fields
        const payload: Partial<PlacementDrive> = {};
        if (companyName.trim() !== initialDriveData.companyName) payload.companyName = companyName.trim();
        if ((companyLogoURL.trim() || undefined) !== (initialDriveData.companyLogoURL || undefined)) payload.companyLogoURL = companyLogoURL.trim();
        if (roleTitle.trim() !== initialDriveData.roleTitle) payload.roleTitle = roleTitle.trim();
        if (description.trim() !== initialDriveData.description) payload.description = description.trim();
        if ((eligibilityCriteria.trim() || undefined) !== (initialDriveData.eligibilityCriteria || undefined)) payload.eligibilityCriteria = eligibilityCriteria.trim();
        if (status !== initialDriveData.status) payload.status = status;
         // Compare keyDates objects (only include if changed)
         if (JSON.stringify(keyDatesPayload) !== JSON.stringify(initialKeyDatesFormatted)) {
             payload.keyDates = keyDatesPayload; // Send the potentially updated dates object
         }
        if ((packageDetails.trim() || undefined) !== (initialDriveData.packageDetails || undefined)) payload.packageDetails = packageDetails.trim();
        if ((applicationLink.trim() || undefined) !== (initialDriveData.applicationLink || undefined)) payload.applicationLink = applicationLink.trim();
        if ((applicationInstructions.trim() || undefined) !== (initialDriveData.applicationInstructions || undefined)) payload.applicationInstructions = applicationInstructions.trim();
        if ((location.trim() || undefined) !== (initialDriveData.location || undefined)) payload.location = location.trim();
        if (JSON.stringify(eligibleBranches) !== JSON.stringify(initialDriveData.eligibleBranches || [])) payload.eligibleBranches = eligibleBranches;
        if ((contactPerson.trim() || undefined) !== (initialDriveData.contactPerson || undefined)) payload.contactPerson = contactPerson.trim();
        if (commentsEnabled !== (initialDriveData.commentsEnabled !== false)) payload.commentsEnabled = commentsEnabled;

        // If no changes were detected
        if (Object.keys(payload).length === 0) {
            setSuccessMessage("No changes detected.");
            setIsSubmitting(false);
            return;
        }

        try {
            const idToken = await getIdToken(user, true); // Get fresh token
            console.log("🔄 Sending PATCH request for drive:", payload);

            // Send PATCH request to the specific drive API endpoint
            const response = await fetch(`/api/placement/drives/${driveId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Update failed (${response.status})`);
            }

            const result = await response.json(); // Expect { message: ..., drive: ... }
            console.log("✅ Drive update successful:", result);
            setSuccessMessage("Drive details updated successfully! Redirecting...");

            // Update local initial data state with the data returned from PATCH
            // This ensures subsequent edits compare against the *latest* saved data
            setInitialDriveData(result.drive || null); // Assuming PATCH returns the updated drive object

             // Redirect back to the main placements list page after a short delay
             const destinationUrl = `/placements`;
             console.log(`🚀 Attempting redirect via router.push to: ${destinationUrl}`);
             setTimeout(() => {
                 if (router) router.push(destinationUrl);
                 else console.error("Router instance missing for redirect.");
             }, 1500); // Redirect after 1.5 seconds

             // Keep submitting=true during timeout to prevent further edits

        } catch (err: any) {
            console.error("❌ Failed to submit drive update:", err);
            setSubmitError(err.message || "An unknown error occurred during update."); // Use specific submit error state
            setSuccessMessage(null);
            setIsSubmitting(false); // Allow retry on error
        }
    };

    // --- Define shared input styles ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 disabled:opacity-60";
    const selectStyle = "w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-9";
    const checkboxStyle = "focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded";
    const textareaStyle = `${inputStyle} min-h-[80px]`; // Consistent textarea style


    // --- Render Logic ---
    if (isLoadingData || !authChecked) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Loading...</div>; }
    // Show error if fetch failed or user doesn't have permission initially
    if ((error || !isOwner) && !isLoadingData) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">{error || "Permission Denied."}</p> <Link href="/placements" className="text-blue-600 hover:underline">Back to Placements</Link> </div> ); }
    // Fallback if data is still null after loading (should not happen if error handling is correct)
    if (!initialDriveData) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Placement drive data could not be loaded.</div>; }

    // --- Render Edit Form ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-3 flex-wrap gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                    Edit Placement Drive
                </h1>
                {/* Cancel Link back to main placements page */}
                 <Link href={`/placements`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                    Cancel Edit
                 </Link>
            </div>

            {/* Form Container */}
             <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 p-6 sm:p-8 bg-white rounded-lg shadow-md">
                 {/* Company Name */}
                <div><label htmlFor="editCompanyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-600">*</span></label><input type="text" id="editCompanyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className={inputStyle} /></div>
                {/* Role Title */}
                <div><label htmlFor="editRoleTitle" className="block text-sm font-medium text-gray-700 mb-1">Role Title <span className="text-red-600">*</span></label><input type="text" id="editRoleTitle" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} required className={inputStyle} /></div>
                 {/* Logo URL */}
                <div><label htmlFor="editCompanyLogoURL" className="block text-sm font-medium text-gray-700 mb-1">Company Logo URL</label><input type="url" id="editCompanyLogoURL" value={companyLogoURL} onChange={(e) => setCompanyLogoURL(e.target.value)} className={inputStyle} placeholder="https://..." /></div>
                {/* Description */}
                <div><label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-600">*</span></label><textarea id="editDescription" value={description} onChange={(e) => setDescription(e.target.value)} required className={textareaStyle} rows={5} /></div>
                {/* Eligibility */}
                <div><label htmlFor="editEligibilityCriteria" className="block text-sm font-medium text-gray-700 mb-1">Eligibility Criteria</label><textarea id="editEligibilityCriteria" value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(e.target.value)} className={textareaStyle} rows={3}/></div>
                 {/* Status */}
                 <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4"><label htmlFor="editStatus" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-0 flex-shrink-0">Status <span className="text-red-600">*</span></label><select id="editStatus" value={status} onChange={(e) => setStatus(e.target.value as PlacementStatus)} required className={selectStyle}>{placementStatusOptions.map(s => ( <option key={s} value={s}>{s}</option> ))}</select></div>

                 {/* Key Dates */}
                <fieldset className="border rounded-md p-3 pt-1 border-gray-300"> <legend className="text-xs font-medium text-gray-600 px-1">Key Dates</legend> <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2"> <div><label htmlFor="editDeadlineDate" className="block text-xs font-medium text-gray-700 mb-0.5">Deadline</label><input type="date" id="editDeadlineDate" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className={inputStyle} /></div> <div><label htmlFor="editTestDate" className="block text-xs font-medium text-gray-700 mb-0.5">Test Date</label><input type="date" id="editTestDate" value={testDate} onChange={e => setTestDate(e.target.value)} className={inputStyle} /></div> <div><label htmlFor="editInterviewDate" className="block text-xs font-medium text-gray-700 mb-0.5">Interview</label><input type="date" id="editInterviewDate" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} className={inputStyle} /></div> <div><label htmlFor="editStartDate" className="block text-xs font-medium text-gray-700 mb-0.5">Start Date</label><input type="date" id="editStartDate" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputStyle} /></div> </div> </fieldset>

                 {/* Package */}
                 <div><label htmlFor="editPackageDetails" className="block text-sm font-medium text-gray-700 mb-1">Package Details</label><input type="text" id="editPackageDetails" value={packageDetails} onChange={(e) => setPackageDetails(e.target.value)} className={inputStyle} /></div>
                 {/* App Link */}
                 <div><label htmlFor="editApplicationLink" className="block text-sm font-medium text-gray-700 mb-1">Application Link</label><input type="url" id="editApplicationLink" value={applicationLink} onChange={(e) => setApplicationLink(e.target.value)} className={inputStyle} placeholder="https://..." /></div>
                 {/* App Instructions */}
                 <div><label htmlFor="editApplicationInstructions" className="block text-sm font-medium text-gray-700 mb-1">Application Instructions</label><textarea id="editApplicationInstructions" value={applicationInstructions} onChange={(e) => setApplicationInstructions(e.target.value)} className={textareaStyle} rows={3}/></div>
                 {/* Location */}
                 <div><label htmlFor="editLocation" className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" id="editLocation" value={location} onChange={(e) => setLocation(e.target.value)} className={inputStyle} /></div>
                 {/* Branches */}
                 <div><label htmlFor="editEligibleBranchesInput" className="block text-sm font-medium text-gray-700 mb-1">Eligible Branches</label><input type="text" id="editEligibleBranchesInput" value={eligibleBranchesInput} onChange={(e) => setEligibleBranchesInput(e.target.value)} className={inputStyle} placeholder="Comma-separated" /><p className="text-xs text-gray-500 mt-1">Separate with commas.</p></div>
                 {/* Contact */}
                 <div><label htmlFor="editContactPerson" className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label><input type="text" id="editContactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputStyle} /></div>
                 {/* Comments Enabled */}
                 <div className="flex items-start pt-4 border-t border-gray-200 mt-6"> <div className="flex items-center h-5"> <input id="editCommentsEnabled" type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} className={checkboxStyle} /> </div> <div className="ml-3 text-sm"> <label htmlFor="editCommentsEnabled" className="font-medium text-gray-700">Enable Q&A/Comments</label> <p className="text-xs text-gray-500">Allow users to ask questions.</p> </div> </div>

                {/* Feedback Area */}
                <div className='min-h-[40px] pt-2'>
                    {/* Use specific submitError state */}
                    {submitError && !successMessage && ( <p className="text-sm text-red-600 p-2 bg-red-50 border border-red-200 rounded">Error: {submitError}</p> )}
                    {successMessage && ( <p className="text-sm text-green-600 p-2 bg-green-50 border border-green-200 rounded">{successMessage}</p> )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button type="submit" disabled={isSubmitting || !isOwner || !!successMessage} className="order-1 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                     {/* Cancel Button links back to the main placements list */}
                    <Link href={`/placements`} legacyBehavior>
                        <a className="order-2 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"> Cancel </a>
                    </Link>
                    {/* Delete button removed from edit page, should be on detail view banner */}
                </div>
            </form>

            {/* Delete Confirmation Modal (Keep if delete is needed on edit page too) */}
             {/* You might remove this if delete is ONLY on the detail page banner */}
             {/* {showDeleteModal && initialDriveData && ( ... modal JSX ... )} */}

        </div> // Close main container
    );
}