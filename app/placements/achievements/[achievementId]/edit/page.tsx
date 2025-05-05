// app/placements/achievements/[achievementId]/edit/page.tsx
"use client";

import React, { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase'; // Adjust path if needed
import { StudentAchievement, PlacementType } from '@/lib/types/placement'; // Adjust path if needed

// Placement Type Options
const placementTypeOptions: Array<PlacementType | ''> = ['', 'Full-time', 'Internship', 'PPO', 'Other'];

export default function EditAchievementPage() {
    const params = useParams();
    const router = useRouter();
    const auth = getAuth(app);

    // --- State ---
    const [initialAchievementData, setInitialAchievementData] = useState<StudentAchievement | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true); // Loading initial data
    const [isSubmitting, setIsSubmitting] = useState(false); // Saving changes
    const [error, setError] = useState<string | null>(null); // General/Fetch error
    const [submitError, setSubmitError] = useState<string | null>(null); // Specific submission error
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // --- Form State ---
    // Initialize based on StudentAchievement fields (matching create form)
    const [companyName, setCompanyName] = useState('');
    const [roleTitle, setRoleTitle] = useState('');
    const [placementType, setPlacementType] = useState<PlacementType | ''>('');
    const [studentBranch, setStudentBranch] = useState('');
    const [skillsInput, setSkillsInput] = useState('');
    const [location, setLocation] = useState('');
    const [salary, setSalary] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [postText, setPostText] = useState(''); // Main experience text
    const [personalMessage, setPersonalMessage] = useState('');
    // Note: Name fields are not typically edited by the student after posting

    // Extract achievementId safely
    const achievementId = typeof params?.achievementId === 'string' ? params.achievementId : undefined;

    // Ref for textarea resizing (optional)
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // --- Effect: Auth Listener ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true);
        });
        return () => unsubscribe();
    }, [auth]);

    // --- Effect: Fetch Initial Achievement Data ---
    useEffect(() => {
        if (!achievementId || !authChecked) {
            if (!achievementId && authChecked) { setError("Invalid Achievement ID."); setIsLoadingData(false); }
            return;
        }
        let isMounted = true;
        setIsLoadingData(true); setError(null); setInitialAchievementData(null); setIsOwner(false);

        async function loadAchievement() {
            console.log(`Fetching achievement data for edit: ${achievementId}`);
            try {
                // Fetch from the specific achievement API endpoint
                const response = await fetch(`/api/placement/achievements/${achievementId}`);
                if (!isMounted) return;
                if (response.status === 404) throw new Error("Achievement post not found.");
                if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || `API Error: ${response.status}`); }
                const data = await response.json();
                if (!data.achievement) throw new Error("Invalid data format received.");
                if (!isMounted) return;

                const fetchedAchievement: StudentAchievement = data.achievement;
                setInitialAchievementData(fetchedAchievement);

                // --- Populate Form State ---
                setCompanyName(fetchedAchievement.companyName || '');
                setRoleTitle(fetchedAchievement.roleTitle || '');
                setPlacementType(fetchedAchievement.placementType || '');
                setStudentBranch(fetchedAchievement.studentBranch || '');
                setSkillsInput((fetchedAchievement.skills || []).join(', ')); // Join array for input
                setLocation(fetchedAchievement.location || '');
                setSalary(fetchedAchievement.salary || '');
                setJobDescription(fetchedAchievement.jobDescription || '');
                setPostText(fetchedAchievement.text || ''); // Main experience text
                setPersonalMessage(fetchedAchievement.personalMessage || '');

                // Check Ownership
                if (user && user.uid === fetchedAchievement.studentId) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                    setError(user ? "Permission denied: You can only edit your own posts." : "Please log in to edit.");
                }
            } catch (err: any) { if (isMounted) setError(err.message); setIsOwner(false); }
            finally { if (isMounted) setIsLoadingData(false); }
        }

        if (authChecked) { loadAchievement(); } // Fetch only after auth check
        return () => { isMounted = false; };
    }, [achievementId, authChecked, user]); // Re-run if ID, auth, or user changes


    // --- Handle Form Submission (Save Changes) ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isOwner || !user || !initialAchievementData || !achievementId) {
            setSubmitError("Cannot submit: Not authorized or data missing."); return;
        }
        setIsSubmitting(true); setSubmitError(null); setSuccessMessage(null);

        // Basic validation
        if (!companyName.trim() || !postText.trim()) {
             setSubmitError("Company Name and Your Message/Experience are required.");
             setIsSubmitting(false); return;
        }
        const skillsArray = skillsInput.split(',').map(s => s.trim()).filter(Boolean);

        // Build payload with ONLY changed fields
        const payload: Partial<StudentAchievement> = {};
        // Compare current form state with initialAchievementData
        if (companyName.trim() !== initialAchievementData.companyName) payload.companyName = companyName.trim();
        if ((roleTitle.trim() || undefined) !== (initialAchievementData.roleTitle || undefined)) payload.roleTitle = roleTitle.trim();
        if ((placementType || undefined) !== (initialAchievementData.placementType || undefined)) payload.placementType = placementType || undefined;
        if ((studentBranch.trim() || undefined) !== (initialAchievementData.studentBranch || undefined)) payload.studentBranch = studentBranch.trim();
        if (JSON.stringify(skillsArray) !== JSON.stringify(initialAchievementData.skills || [])) payload.skills = skillsArray;
        if ((location.trim() || undefined) !== (initialAchievementData.location || undefined)) payload.location = location.trim();
        if ((salary.trim() || undefined) !== (initialAchievementData.salary || undefined)) payload.salary = salary.trim();
        if ((jobDescription.trim() || undefined) !== (initialAchievementData.jobDescription || undefined)) payload.jobDescription = jobDescription.trim();
        if (postText.trim() !== initialAchievementData.text) payload.text = postText.trim();
        if ((personalMessage.trim() || undefined) !== (initialAchievementData.personalMessage || undefined)) payload.personalMessage = personalMessage.trim();
        // Add companyLogoURL if it becomes editable

        if (Object.keys(payload).length === 0) {
            setSuccessMessage("No changes detected."); setIsSubmitting(false); return;
        }

        try {
            const idToken = await getIdToken(user, true);
            console.log("🔄 Sending PATCH request for achievement:", payload);

            // Send PATCH request to the specific achievement API endpoint
            const response = await fetch(`/api/placement/achievements/${achievementId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
                body: JSON.stringify(payload),
            });

            if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || e.details || `Update failed (${response.status})`); }

            const result = await response.json(); // Expect { message: ..., achievement: ... }
            console.log("✅ Achievement update successful:", result);
            setSuccessMessage("Post updated successfully! Redirecting...");
            // Update initial data state to reflect saved changes
            setInitialAchievementData(result.achievement || null);

             // Redirect back to the main placements page after a delay
             const destinationUrl = `/placements`;
             console.log(`🚀 Attempting redirect via router.push to: ${destinationUrl}`);
             setTimeout(() => { if (router) router.push(destinationUrl); }, 1500); // 1.5s delay

        } catch (err: any) {
            console.error("❌ Failed to submit achievement update:", err);
            setSubmitError(err.message || "An unknown error occurred during update.");
            setSuccessMessage(null);
            setIsSubmitting(false); // Allow retry on error
        }
    };

    // --- Define input styles --- (Copied)
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 disabled:opacity-60";
    const selectStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 h-9";
    const textareaStyle = `${inputStyle} min-h-[80px]`;

    // --- Render Logic ---
    if (isLoadingData || !authChecked) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Loading...</div>; }
    if (error) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">{error}</p> <Link href="/placements" className="text-blue-600 hover:underline">Back to Placements</Link> </div> ); }
    if (!initialAchievementData) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Achievement post not found or unavailable.</div>; }
    if (!isOwner) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">Permission Denied. You can only edit your own posts.</p> <Link href="/placements" className="text-blue-600 hover:underline">Back to Placements</Link> </div> ); }

    // --- Render Edit Form ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b border-gray-200 pb-3">
                Edit Achievement Post
            </h1>

             <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 p-6 sm:p-8 bg-white rounded-lg shadow-md">
                 {/* Replicate form structure from Create Modal, using bound state */}
                 <fieldset className="border rounded-md p-3 pt-1 border-gray-300"> <legend className="text-xs font-medium text-gray-600 px-1">Placement Details</legend> <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-2"> <div><label htmlFor="companyName" className="block text-xs font-medium text-gray-700 mb-0.5">Company <span className="text-red-600">*</span></label><input type="text" id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} required className={inputStyle} /></div> <div><label htmlFor="roleTitle" className="block text-xs font-medium text-gray-700 mb-0.5">Role Title</label><input type="text" id="roleTitle" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} className={inputStyle} /></div> <div><label htmlFor="placementType" className="block text-xs font-medium text-gray-700 mb-0.5">Type</label><select id="placementType" value={placementType} onChange={e => setPlacementType(e.target.value as PlacementType | '')} className={selectStyle}>{placementTypeOptions.map(type => ( <option key={type} value={type}>{type === '' ? 'Select Type' : type}</option> ))}</select></div> <div><label htmlFor="studentBranch" className="block text-xs font-medium text-gray-700 mb-0.5">Branch/Dept</label><input type="text" id="studentBranch" value={studentBranch} onChange={e => setStudentBranch(e.target.value)} className={inputStyle} /></div> <div><label htmlFor="location" className="block text-xs font-medium text-gray-700 mb-0.5">Location</label><input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} className={inputStyle} /></div> <div><label htmlFor="salary" className="block text-xs font-medium text-gray-700 mb-0.5">Salary/Stipend</label><input type="text" id="salary" value={salary} onChange={e => setSalary(e.target.value)} className={inputStyle} /></div> </div> </fieldset>
                 <div> <label htmlFor="skillsInput" className="block text-sm font-medium text-gray-700 mb-1">Key Skills</label> <input type="text" id="skillsInput" value={skillsInput} onChange={e => setSkillsInput(e.target.value)} className={inputStyle} placeholder="Comma-separated" /> </div>
                 <div> <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-1">Role Description</label> <textarea id="jobDescription" value={jobDescription} onChange={e => setJobDescription(e.target.value)} className={textareaStyle + " min-h-[60px]"} rows={2} /> </div>
                 <div> <label htmlFor="postText" className="block text-sm font-medium text-gray-700 mb-1">Your Message / Experience <span className="text-red-600">*</span></label> <textarea id="postText" ref={textareaRef} value={postText} onChange={(e) => setPostText(e.target.value)} className={textareaStyle + " min-h-[100px]"} rows={4} required /> </div>
                 <div> <label htmlFor="personalMessage" className="block text-sm font-medium text-gray-700 mb-1">Personal Message</label> <textarea id="personalMessage" value={personalMessage} onChange={e => setPersonalMessage(e.target.value)} className={textareaStyle + " min-h-[60px]"} rows={2} /> </div>
                 {/* Image upload might be added here later */}

                 {/* Feedback Area */}
                 <div className='min-h-[40px] pt-2'>
                    {submitError && !successMessage && ( <p className="text-sm text-red-600 p-2 bg-red-50 border border-red-200 rounded">Error: {submitError}</p> )}
                    {successMessage && ( <p className="text-sm text-green-600 p-2 bg-green-50 border border-green-200 rounded">{successMessage}</p> )}
                 </div>

                 {/* Action Buttons */}
                 <div className="pt-5 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button type="submit" disabled={isSubmitting || !isOwner || !!successMessage} className="order-1 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                     {/* Link back to main placements page */}
                    <Link href="/placements" legacyBehavior>
                        <a className="order-2 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                            Cancel
                        </a>
                    </Link>
                     {/* Delete button is usually on the detail view/modal, not typically needed here */}
                 </div>
            </form>
        </div>
    );
}