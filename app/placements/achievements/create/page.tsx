// app/placements/achievements/create/page.tsx
"use client";

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // For cancel button navigation
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth'; // Firebase Auth functions
import app from '@/app/firebase'; // Your Firebase app instance (Adjust path if needed)
import { PlacementType } from '@/lib/types/placement'; // Import PlacementType enum/union (Adjust path if needed)

// Define options for the Placement Type dropdown
const placementTypeOptions: Array<PlacementType | ''> = ['', 'Full-time', 'Internship', 'PPO', 'Other'];

// Placeholder function for role check (replace with actual logic if needed)
// Determines if the logged-in user *should* be allowed to access this page.
// For achievements, usually any logged-in user can post.
const checkUserPermission = async (user: User | null): Promise<boolean> => {
    // For now, simply check if the user is logged in.
    // You could add checks here (e.g., isStudent role) if necessary.
    return !!user;
};

// --- Create Achievement Page Component ---
export default function CreateAchievementPage() {
    const router = useRouter();
    const auth = getAuth(app);

    // --- State ---
    const [user, setUser] = useState<User | null>(null); // Current authenticated user
    const [isAuthorized, setIsAuthorized] = useState(false); // Permission to create
    const [isLoading, setIsLoading] = useState(false); // Form submission loading state
    const [error, setError] = useState<string | null>(null); // Error messages for the user
    const [authChecked, setAuthChecked] = useState(false); // Tracks if the initial auth check ran

    // --- Form State --- (Holds values for all form inputs)
    const [firstName, setFirstName] = useState(''); // Placed student's first name
    const [fatherName, setFatherName] = useState(''); // Optional: Father's name
    const [motherName, setMotherName] = useState(''); // Optional: Mother's name
    const [surname, setSurname] = useState(''); // Placed student's surname
    const [postText, setPostText] = useState(''); // Main message/experience text (required)
    const [companyName, setCompanyName] = useState(''); // Company name (required)
    const [roleTitle, setRoleTitle] = useState(''); // Role title (optional)
    const [placementType, setPlacementType] = useState<PlacementType | ''>(''); // Placement type dropdown
    const [studentBranch, setStudentBranch] = useState(''); // Placed student's branch
    const [skillsInput, setSkillsInput] = useState(''); // Comma-separated skills input
    const [location, setLocation] = useState(''); // Job location
    const [salary, setSalary] = useState(''); // Salary/package description
    const [jobDescription, setJobDescription] = useState(''); // Role description textarea
    const [personalMessage, setPersonalMessage] = useState(''); // Personal quote/message textarea

    // Ref for the main message textarea for potential auto-resizing
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const jobDescRef = useRef<HTMLTextAreaElement>(null); // Ref for job desc textarea
    const personalMsgRef = useRef<HTMLTextAreaElement>(null); // Ref for personal message textarea

    // --- Authentication Check and Authorization Effect ---
    useEffect(() => {
        setIsLoading(true); // Indicate initial loading state (for auth check)
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Perform permission check
                const authorized = await checkUserPermission(currentUser);
                setIsAuthorized(authorized);
                if (!authorized) {
                    setError("You do not have permission to add placement achievements.");
                }
            } else {
                // If no user, they are not authorized
                setIsAuthorized(false);
                // Optional: Redirect immediately if not logged in after check has run
                if (authChecked) {
                     console.log("Create Achievement Page: User not logged in after check, redirecting...");
                     router.push('/placements'); // Redirect back to hub if not logged in
                }
            }
            setAuthChecked(true); // Mark that the check is complete
            setIsLoading(false); // Stop initial loading
        });
        // Cleanup the listener when the component unmounts
        return () => unsubscribe();
    }, [auth, router, authChecked]); // Include authChecked in dependencies

     // --- Textarea Auto-Resize Effects ---
     // Adjusts height based on content for multiple textareas
     useEffect(() => {
        const resizeTextarea = (ref: React.RefObject<HTMLTextAreaElement>) => {
            if (ref.current) {
                const textarea = ref.current;
                textarea.style.height = 'auto'; // Reset height
                const scrollHeight = textarea.scrollHeight;
                const maxHeight = 120; // Max height in pixels
                textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
                textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
            }
        };
        resizeTextarea(textareaRef); // Resize main message
        resizeTextarea(jobDescRef); // Resize job description
        resizeTextarea(personalMsgRef); // Resize personal message
    }, [postText, jobDescription, personalMessage]); // Rerun when any relevant text changes


    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent default page reload
        setError(null); // Clear previous submission errors

        // --- Validation Checks ---
        if (!user) { setError("You must be logged in to share an achievement."); return; }
        // Re-check authorization on submit just in case
        if (!isAuthorized) { setError("Submission failed: Not authorized."); return; }
        // Check required form fields
        if (!postText.trim() || !companyName.trim() || !firstName.trim() || !surname.trim()) {
            setError("Please fill in all required fields (*)."); return;
        }

        setIsLoading(true); // Set loading indicator for submission
        // Process skills input into an array of non-empty strings
        const skillsArray = skillsInput.split(',').map(s => s.trim()).filter(Boolean);

        // Prepare data payload for the API
        // This structure should match the StudentAchievement type and backend expectations
        const achievementData = {
            // Placed Student Info (from form)
            placedStudentName: `${firstName.trim()} ${surname.trim()}`,
            placedStudentBranch: studentBranch.trim() || undefined,
            placedStudentYear: undefined, // Add state/input if you collect this
            // placedStudentPhotoURL: // Add state/input if you collect this

            // Placement Details (from form)
            companyName: companyName.trim(),
            companyLogoURL: undefined, // Add state/input if you collect this
            roleTitle: roleTitle.trim() || undefined,
            placementType: placementType || undefined,
            location: location.trim() || undefined,
            salary: salary.trim() || undefined,

            // Content Fields (from form)
            jobDescription: jobDescription.trim() || undefined,
            skills: skillsArray.length > 0 ? skillsArray : undefined,
            text: postText.trim(), // Main message/experience (required)
            personalMessage: personalMessage.trim() || undefined,

            // Creator info (like creatorId, creatorName, creatorPhotoURL)
            // is added by the backend API based on the authenticated user's token.
        };

        try {
            const idToken = await getIdToken(user, true); // Get fresh auth token
            console.log("Submitting new achievement:", achievementData);

            // Send POST request to the backend API endpoint
            const response = await fetch('/api/placement/achievements', { // Ensure correct API path
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify(achievementData),
            });

            // Handle non-successful responses
            if (!response.ok) {
                let errorDetails = `Failed to post achievement (${response.status})`;
                try { const errorData = await response.json(); errorDetails = errorData.error || errorData.details || errorDetails; } catch {}
                throw new Error(errorDetails);
            }

            const result = await response.json(); // Expect { message: string, achievementId: string }
            console.log("Achievement posted:", result);
            router.push('/placements'); // Redirect back to main hub on success

        } catch (err: any) {
            console.error("❌ Failed to submit achievement:", err);
            setError(err.message || "An unknown error occurred while posting.");
            setIsLoading(false); // Stop loading on error to allow correction
        }
        // No finally block needed as redirect handles loading state change on success
    };

    // --- Define shared input styles ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 disabled:opacity-60";
    const selectStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-9";
    const textareaStyle = `${inputStyle} min-h-[80px]`; // Base textarea style

    // --- Render Logic ---
    // Show loading indicator while checking authentication
    if (!authChecked) {
        return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Verifying access...</div>;
    }
    // Show appropriate message if user is not logged in or not authorized
    if (!user || !isAuthorized) {
         return (
            <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center">
                <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">
                    {user ? "You do not have permission to share achievements." : "Please log in to share an achievement."}
                </p>
                <Link href="/placements" className="text-blue-600 hover:underline">Back to Placements Hub</Link>
            </div>
        );
    }

    // --- Render Create Form ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
             {/* Page Header */}
             <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-3 flex-wrap gap-2">
                <h1 className="text-3xl font-bold text-gray-800">
                    Share Placement Success
                </h1>
                {/* Cancel Link */}
                 <Link href="/placements" className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                     Cancel
                 </Link>
            </div>

            {/* Form Container */}
             <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 p-6 sm:p-8 bg-white rounded-lg shadow-md">
                 {/* Use Fieldsets for better grouping */}
                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                     <legend className="text-xs font-medium text-gray-600 px-1">Placed Student's Name</legend>
                     {/* Grid layout for name fields */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2">
                         <div><label htmlFor="firstName" className="block text-xs font-medium text-gray-700 mb-0.5">First Name <span className="text-red-600">*</span></label><input type="text" id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputStyle} /></div>
                         <div><label htmlFor="surname" className="block text-xs font-medium text-gray-700 mb-0.5">Surname <span className="text-red-600">*</span></label><input type="text" id="surname" value={surname} onChange={e => setSurname(e.target.value)} required className={inputStyle} /></div>
                         <div><label htmlFor="fatherName" className="block text-xs font-medium text-gray-700 mb-0.5">Father's Name (Optional)</label><input type="text" id="fatherName" value={fatherName} onChange={e => setFatherName(e.target.value)} className={inputStyle} /></div>
                         <div><label htmlFor="motherName" className="block text-xs font-medium text-gray-700 mb-0.5">Mother's Name (Optional)</label><input type="text" id="motherName" value={motherName} onChange={e => setMotherName(e.target.value)} className={inputStyle} /></div>
                     </div>
                 </fieldset>

                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300">
                     <legend className="text-xs font-medium text-gray-600 px-1">Placement Details</legend>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2">
                         {/* Company Name */}
                         <div><label htmlFor="companyName" className="block text-xs font-medium text-gray-700 mb-0.5">Company <span className="text-red-600">*</span></label><input type="text" id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} required className={inputStyle} /></div>
                         {/* Role Title */}
                         <div><label htmlFor="roleTitle" className="block text-xs font-medium text-gray-700 mb-0.5">Role Title</label><input type="text" id="roleTitle" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} className={inputStyle} /></div>
                         {/* Placement Type */}
                         <div><label htmlFor="placementType" className="block text-xs font-medium text-gray-700 mb-0.5">Placement Type</label><select id="placementType" value={placementType} onChange={e => setPlacementType(e.target.value as PlacementType | '')} className={selectStyle}>{placementTypeOptions.map(type => ( <option key={type} value={type}>{type === '' ? 'Select Type (Optional)' : type}</option> ))}</select></div>
                         {/* Student Branch */}
                         <div><label htmlFor="studentBranch" className="block text-xs font-medium text-gray-700 mb-0.5">Placed Student's Branch/Dept</label><input type="text" id="studentBranch" value={studentBranch} onChange={e => setStudentBranch(e.target.value)} className={inputStyle} /></div>
                         {/* Location */}
                         <div><label htmlFor="location" className="block text-xs font-medium text-gray-700 mb-0.5">Location</label><input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} className={inputStyle} /></div>
                         {/* Salary */}
                         <div><label htmlFor="salary" className="block text-xs font-medium text-gray-700 mb-0.5">Salary/Stipend (Optional)</label><input type="text" id="salary" value={salary} onChange={e => setSalary(e.target.value)} className={inputStyle} /></div>
                     </div>
                 </fieldset>

                 {/* Skills */}
                 <div>
                     <label htmlFor="skillsInput" className="block text-sm font-medium text-gray-700 mb-1">Key Skills (Optional)</label>
                     {/* *** Corrected onChange for Skills *** */}
                     <input type="text" id="skillsInput" value={skillsInput} onChange={e => setSkillsInput(e.target.value)} className={inputStyle} placeholder="Comma-separated, e.g., React, Python, AWS" />
                     <p className="text-xs text-gray-500 mt-1">Separate skills with commas.</p>
                 </div>

                 {/* Job Description */}
                 <div>
                     <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-1">Brief Role Description (Optional)</label>
                      {/* *** Corrected onChange for Job Description *** */}
                     <textarea id="jobDescription" value={jobDescription} onChange={e => setJobDescription(e.target.value)} className={`${textareaStyle} min-h-[60px]`} rows={2} />
                 </div>

                 {/* Main Message/Experience */}
                <div>
                    <label htmlFor="postText" className="block text-sm font-medium text-gray-700 mb-1">Your Experience / Advice <span className="text-red-600">*</span></label>
                    <textarea id="postText" ref={textareaRef} value={postText} onChange={(e) => setPostText(e.target.value)} className={`${textareaStyle} min-h-[100px]`} rows={4} required placeholder="Share details about the recruitment process, your experience, interview tips, or words of encouragement..."/>
                </div>

                 {/* Personal Message */}
                <div>
                    <label htmlFor="personalMessage" className="block text-sm font-medium text-gray-700 mb-1">Personal Message / Quote (Optional)</label>
                    {/* *** Corrected onChange for Personal Message *** */}
                    <textarea id="personalMessage" value={personalMessage} onChange={e => setPersonalMessage(e.target.value)} className={`${textareaStyle} min-h-[60px]`} rows={2} placeholder='e.g., "Thanks to the T&P cell!", "Hard work pays off!"'/>
                </div>

                {/* Image Upload Placeholder - Functional upload TBD */}
                 {/* <div className="pt-2"> <label className="block text-sm font-medium text-gray-700 mb-1">Add Image (Optional)</label> <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/> </div> */}

                 {/* Error Message Display */}
                 {error && (
                    <p className="text-sm text-red-600 p-3 bg-red-50 border border-red-200 rounded-md">
                        <strong>Error:</strong> {error}
                    </p>
                 )}

                 {/* Action Buttons */}
                 <div className="pt-5 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="order-1 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {/* Loading Spinner */}
                         {isLoading && (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>)}
                        {isLoading ? 'Posting...' : 'Post Achievement'}
                    </button>
                    {/* Cancel Link */}
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