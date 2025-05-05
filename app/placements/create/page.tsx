// app/placements/create/page.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // For cancel button
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase'; // Adjust path if needed
import { PlacementStatus } from '@/lib/types/placement'; // Adjust path if needed

// Define available options for status
const placementStatusOptions: PlacementStatus[] = ['Upcoming', 'Ongoing', 'Past', 'Cancelled'];

// Placeholder for role check function (replace with your actual implementation)
// This determines if the logged-in user *should* be allowed to create drives.
const checkUserRole = async (user: User | null): Promise<boolean> => {
    // Example: Replace this with your actual role checking logic
    // - Check custom claims on the user's ID token (set via Admin SDK)
    // - Query a 'users' collection in Firestore for a 'role' field
    console.warn("Role check not implemented. Allowing any logged-in user for now.");
    return !!user; // For now, allow any logged-in user
};

export default function CreatePlacementDrivePage() {
    const router = useRouter();
    const auth = getAuth(app);

    // --- State ---
    const [user, setUser] = useState<User | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false); // To check if user has permission
    const [isLoading, setIsLoading] = useState(false); // For form submission loading state
    const [error, setError] = useState<string | null>(null); // For submission/authorization errors
    const [authChecked, setAuthChecked] = useState(false); // Initial auth check status

    // --- Form State (Initialize all fields) ---
    const [companyName, setCompanyName] = useState('');
    const [companyLogoURL, setCompanyLogoURL] = useState('');
    const [roleTitle, setRoleTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eligibilityCriteria, setEligibilityCriteria] = useState('');
    const [status, setStatus] = useState<PlacementStatus>('Upcoming'); // Default to 'Upcoming'
    // Key dates - manage as strings (YYYY-MM-DD)
    const [deadlineDate, setDeadlineDate] = useState('');
    const [testDate, setTestDate] = useState('');
    const [interviewDate, setInterviewDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [packageDetails, setPackageDetails] = useState('');
    const [applicationLink, setApplicationLink] = useState('');
    const [applicationInstructions, setApplicationInstructions] = useState('');
    const [location, setLocation] = useState('');
    const [eligibleBranchesInput, setEligibleBranchesInput] = useState(''); // Comma-separated
    const [contactPerson, setContactPerson] = useState('');
    const [commentsEnabled, setCommentsEnabled] = useState(true); // Q&A toggle, default true

    // --- Auth Check & Authorization ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Perform role check when user is identified
                const authorized = await checkUserRole(currentUser);
                setIsAuthorized(authorized);
                if (!authorized) {
                    setError("You do not have permission to add placement drives.");
                }
            } else {
                setIsAuthorized(false); // Not authorized if not logged in
                 // Optional: Redirect immediately if not logged in after check
                 // if (authChecked) router.push('/placements');
            }
            setAuthChecked(true); // Mark auth check as complete
        });
        return () => unsubscribe(); // Cleanup listener
    }, [auth]); // Rerun only if auth object changes


    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent default browser form submission
        setError(null); // Clear previous errors

        // Re-check authorization on submit
        if (!user || !isAuthorized) {
            setError("Submission failed: Not authorized.");
            return;
        }

        setIsLoading(true); // Set loading state

        // Basic client-side validation for required fields
        if (!companyName.trim() || !roleTitle.trim() || !description.trim()) {
            setError("Please fill in Company Name, Role Title, and Description (*).");
            setIsLoading(false); // Stop loading
            return;
        }
        // Process comma-separated branches into an array
        const eligibleBranches = eligibleBranchesInput.split(',').map(s => s.trim()).filter(Boolean);

        // Construct keyDates object, only including dates that have a value
         const keyDatesPayload: { [key: string]: string } = {};
         if (deadlineDate) keyDatesPayload.applicationDeadline = deadlineDate;
         if (testDate) keyDatesPayload.testDate = testDate;
         if (interviewDate) keyDatesPayload.interviewDate = interviewDate;
         if (startDate) keyDatesPayload.startDate = startDate;

        // Prepare data payload for the API
        // Ensure keys match the expected structure in POST /api/placement/drives
        const driveData = {
            companyName: companyName.trim(),
            companyLogoURL: companyLogoURL.trim() || undefined, // Send undefined if empty
            roleTitle: roleTitle.trim(),
            description: description.trim(),
            eligibilityCriteria: eligibilityCriteria.trim() || undefined,
            status: status, // Already validated by select input
            keyDates: Object.keys(keyDatesPayload).length > 0 ? keyDatesPayload : undefined, // Send object or undefined
            packageDetails: packageDetails.trim() || undefined,
            applicationLink: applicationLink.trim() || undefined,
            applicationInstructions: applicationInstructions.trim() || undefined,
            location: location.trim() || undefined,
            eligibleBranches: eligibleBranches.length > 0 ? eligibleBranches : undefined, // Send array or undefined
            contactPerson: contactPerson.trim() || undefined,
            commentsEnabled: commentsEnabled,
            // postedById, postedByName, postedByPhotoURL are set by the backend using the token
        };

        try {
            const idToken = await getIdToken(user); // Get auth token
            console.log("Submitting new placement drive:", driveData);

            // Send POST request to the backend API
            const response = await fetch('/api/placement/drives', { // Use correct endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(driveData),
            });

            // Handle non-successful responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error
                // Prioritize error message from backend
                throw new Error(errorData.error || `Failed to create drive (${response.status}): ${errorData.details || 'Unknown server error'}`);
            }

            const result = await response.json(); // Expect { message: string, driveId: string }
            console.log("Drive created successfully:", result);

            // Redirect to the main placements list page after success
            router.push('/placements');
            // No need to setIsLoading(false) as component will unmount on redirect

        } catch (err: any) {
            console.error("❌ Failed to submit drive:", err);
            setError(err.message || "An unknown error occurred while creating the drive.");
            setIsLoading(false); // Stop loading on error to allow correction
        }
    };

    // --- Define shared input styles ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 disabled:opacity-60";
    const selectStyle = "w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-9";
    const checkboxStyle = "focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded";
    const textareaStyle = `${inputStyle} min-h-[80px]`;

    // --- Render Logic ---
    // Show loading while checking auth
    if (!authChecked) {
        return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Verifying access...</div>;
    }
    // Show permission denied or login message if not authorized
    if (!isAuthorized) {
         return (
            <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center">
                <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">
                    {user ? "You do not have permission to add placement drives." : "Please log in to add a placement drive."}
                </p>
                <Link href="/placements" className="text-blue-600 hover:underline">Back to Placements</Link>
            </div>
        );
    }

    // --- Render Create Form ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-3 flex-wrap gap-2">
                <h1 className="text-3xl font-bold text-gray-800">
                    Add New Placement Drive
                </h1>
                <Link href="/placements" className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                     Cancel
                 </Link>
            </div>

            {/* Form Container */}
             <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 p-6 sm:p-8 bg-white rounded-lg shadow-md">
                 {/* Use Fieldsets to group related inputs */}
                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                    <legend className="text-xs font-medium text-gray-600 px-1">Core Information</legend>
                    <div className="space-y-4 mt-2">
                        <div><label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-600">*</span></label><input type="text" id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className={inputStyle} /></div>
                        <div><label htmlFor="roleTitle" className="block text-sm font-medium text-gray-700 mb-1">Role Title(s) <span className="text-red-600">*</span></label><input type="text" id="roleTitle" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} required className={inputStyle} placeholder="e.g., SDE Intern, Business Analyst"/></div>
                        <div><label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-600">*</span></label><textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required className={textareaStyle} rows={5} placeholder="Detailed job description, company info, recruitment process, rounds..." /></div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4"><label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-0 flex-shrink-0">Status <span className="text-red-600">*</span></label><select id="status" value={status} onChange={(e) => setStatus(e.target.value as PlacementStatus)} required className={selectStyle}>{placementStatusOptions.map(s => ( <option key={s} value={s}>{s}</option> ))}</select></div>
                        <div><label htmlFor="companyLogoURL" className="block text-sm font-medium text-gray-700 mb-1">Company Logo URL</label><input type="url" id="companyLogoURL" value={companyLogoURL} onChange={(e) => setCompanyLogoURL(e.target.value)} className={inputStyle} placeholder="https://..." /></div>
                    </div>
                 </fieldset>

                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                     <legend className="text-xs font-medium text-gray-600 px-1">Details & Eligibility</legend>
                     <div className="space-y-4 mt-2">
                        <div><label htmlFor="eligibilityCriteria" className="block text-sm font-medium text-gray-700 mb-1">Eligibility Criteria</label><textarea id="eligibilityCriteria" value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(e.target.value)} className={textareaStyle} rows={3} placeholder="e.g., CSE/IT, CGPA > 7.0"/></div>
                        <div><label htmlFor="eligibleBranchesInput" className="block text-sm font-medium text-gray-700 mb-1">Eligible Branches</label><input type="text" id="eligibleBranchesInput" value={eligibleBranchesInput} onChange={(e) => setEligibleBranchesInput(e.target.value)} className={inputStyle} placeholder="Comma-separated, e.g., CSE, IT, ECE" /><p className="text-xs text-gray-500 mt-1">Separate branches with commas.</p></div>
                        <div><label htmlFor="packageDetails" className="block text-sm font-medium text-gray-700 mb-1">Package Details</label><input type="text" id="packageDetails" value={packageDetails} onChange={(e) => setPackageDetails(e.target.value)} className={inputStyle} placeholder="e.g., 15 LPA (12 Fixed + 3 Variable)" /></div>
                        <div><label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location(s)</label><input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputStyle} placeholder="e.g., Bangalore, Remote, Multiple" /></div>
                        <div><label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label><input type="text" id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputStyle} placeholder="Name or Email" /></div>
                    </div>
                 </fieldset>

                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                    <legend className="text-xs font-medium text-gray-600 px-1">Key Dates</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2">
                        <div><label htmlFor="deadlineDate" className="block text-xs font-medium text-gray-700 mb-0.5">Application Deadline</label><input type="date" id="deadlineDate" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className={inputStyle} /></div>
                        <div><label htmlFor="testDate" className="block text-xs font-medium text-gray-700 mb-0.5">Test Date</label><input type="date" id="testDate" value={testDate} onChange={e => setTestDate(e.target.value)} className={inputStyle} /></div>
                        <div><label htmlFor="interviewDate" className="block text-xs font-medium text-gray-700 mb-0.5">Interview Date(s)</label><input type="date" id="interviewDate" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} className={inputStyle} /></div>
                        <div><label htmlFor="startDate" className="block text-xs font-medium text-gray-700 mb-0.5">Start Date</label><input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputStyle} /></div>
                    </div>
                 </fieldset>

                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                    <legend className="text-xs font-medium text-gray-600 px-1">Application Process</legend>
                     <div className="space-y-4 mt-2">
                         <div><label htmlFor="applicationLink" className="block text-sm font-medium text-gray-700 mb-1">Application Link</label><input type="url" id="applicationLink" value={applicationLink} onChange={(e) => setApplicationLink(e.target.value)} className={inputStyle} placeholder="https://company.com/apply..." /></div>
                         <div><label htmlFor="applicationInstructions" className="block text-sm font-medium text-gray-700 mb-1">Application Instructions</label><textarea id="applicationInstructions" value={applicationInstructions} onChange={(e) => setApplicationInstructions(e.target.value)} className={textareaStyle} rows={3}/></div>
                     </div>
                 </fieldset>

                 {/* Comments Enabled Toggle */}
                 <div className="flex items-start pt-4 border-t border-gray-200 mt-6">
                     <div className="flex items-center h-5"> <input id="commentsEnabled" type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} className={checkboxStyle} /> </div>
                     <div className="ml-3 text-sm"> <label htmlFor="commentsEnabled" className="font-medium text-gray-700">Enable Q&A/Comments</label> <p className="text-xs text-gray-500">Allow users to ask questions on the drive details page.</p> </div>
                 </div>

                {/* Error Message Display */}
                {error && ( <p className="text-sm text-red-600 p-2 bg-red-50 border border-red-200 rounded">Error: {error}</p> )}

                {/* Action Buttons */}
                <div className="pt-5 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button type="submit" disabled={isLoading} className="order-1 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                         {/* Loading Spinner */}
                         {isLoading ? ( <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg> ) : null}
                        {isLoading ? 'Creating...' : 'Create Drive'}
                    </button>
                    <Link href="/placements" legacyBehavior>
                        <a className="order-2 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                            Cancel
                        </a>
                    </Link>
                </div>
            </form>
        </div>
    );
}