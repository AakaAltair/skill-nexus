// app/projects/[projectId]/edit/page.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link'; // For cancel button link
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase';
// Import types (adjust path if needed)
import { Project, ProjectType, ProjectStatus } from '@/lib/types/project';

// Define available options
const projectTypeOptions: ProjectType[] = ["Personal", "College Course", "Department Initiative", "Competition", "Research", "Open Source Contribution", "Startup Idea", "Tutorial/Example", "Other"];
const projectStatusOptions: ProjectStatus[] = ["Idea", "Planning", "In Progress", "Paused", "Completed", "Archived"];

export default function EditProjectPage() {
    const params = useParams();
    const router = useRouter(); // Get router instance
    const auth = getAuth(app);

    // --- State Variables ---
    const [initialProjectData, setInitialProjectData] = useState<Project | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    // Delete Modal State (Preserved)
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // --- Form State ---
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [skillsInput, setSkillsInput] = useState('');
    const [projectType, setProjectType] = useState<ProjectType>(projectTypeOptions[0]);
    const [status, setStatus] = useState<ProjectStatus>(projectStatusOptions[0]);
    const [location, setLocation] = useState('');
    const [techStack, setTechStack] = useState('');
    const [lookingForMembers, setLookingForMembers] = useState(false);
    const [rolesNeededInput, setRolesNeededInput] = useState('');
    const [coverImageURL, setCoverImageURL] = useState('');
    const [projectLink, setProjectLink] = useState('');
    const [repoLink, setRepoLink] = useState('');
    const [commentsEnabled, setCommentsEnabled] = useState(true); // State for comments toggle (Preserved)

    // Extract projectId safely
    const projectId = typeof params?.projectId === 'string' ? params.projectId : undefined;

    // --- Effect: Auth Listener ---
    useEffect(() => {
        setIsLoadingData(true);
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true);
        });
        return () => unsubscribe();
    }, [auth]);

    // --- Effect: Fetch Project Data ---
    useEffect(() => {
        if (!projectId || !authChecked) {
            if (!projectId && authChecked) { setError("Invalid Project ID."); setIsLoadingData(false); }
            return;
        }
        let isMounted = true;
        setIsLoadingData(true);
        setError(null); setInitialProjectData(null); setIsOwner(false);
        async function loadProject() {
            try {
                const response = await fetch(`/api/projects/${projectId}`);
                if (!isMounted) return;
                if (response.status === 404) throw new Error("Project not found.");
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `API Error: ${response.status}`);
                }
                const data = await response.json();
                if (!data.project) throw new Error("Invalid data format received.");
                if (!isMounted) return;
                const fetchedProject: Project = data.project;
                setInitialProjectData(fetchedProject);
                // Populate Form
                setTitle(fetchedProject.title);
                setDescription(fetchedProject.description);
                setSkillsInput(fetchedProject.skills?.join(', ') || '');
                setProjectType(fetchedProject.projectType);
                setStatus(fetchedProject.status);
                setLocation(fetchedProject.location || '');
                setTechStack(fetchedProject.techStack || '');
                setLookingForMembers(fetchedProject.lookingForMembers || false);
                setRolesNeededInput(fetchedProject.rolesNeeded?.join(', ') || '');
                setCoverImageURL(fetchedProject.coverImageURL || '');
                setProjectLink(fetchedProject.projectLink || '');
                setRepoLink(fetchedProject.repoLink || '');
                setCommentsEnabled(fetchedProject.commentsEnabled !== false); // Populate comments (Preserved)
                // Check Ownership
                if (user && user.uid === fetchedProject.creatorId) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                    setError(user ? "Permission denied." : "Please log in to edit.");
                }
            } catch (err: any) {
                 if (isMounted) setError(err.message);
                 setIsOwner(false);
            } finally {
                 if (isMounted) setIsLoadingData(false);
            }
        }
        loadProject();
        return () => { isMounted = false; };
    }, [projectId, authChecked, user]);

    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isOwner || !user || !initialProjectData || !projectId) {
            setError("Cannot submit form: Not authorized or data missing.");
            return;
        }
        setIsSubmitting(true); setError(null); setSuccessMessage(null);

        const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
        if (!title.trim() || !description.trim() || skills.length === 0) {
             setError("Title, Description, and at least one Skill are required.");
             setIsSubmitting(false); return;
        }
        const rolesNeeded = rolesNeededInput.split(',').map(s => s.trim()).filter(Boolean);

        const payload: Partial<Project & { commentsEnabled: boolean }> = {};
        if (title.trim() !== initialProjectData.title) payload.title = title.trim();
        if (description.trim() !== initialProjectData.description) payload.description = description.trim();
        if (JSON.stringify(skills) !== JSON.stringify(initialProjectData.skills || [])) payload.skills = skills;
        if (projectType !== initialProjectData.projectType) payload.projectType = projectType;
        if (status !== initialProjectData.status) payload.status = status;
        if (location.trim() !== (initialProjectData.location || '')) payload.location = location.trim();
        if (techStack.trim() !== (initialProjectData.techStack || '')) payload.techStack = techStack.trim();
        if (lookingForMembers !== (initialProjectData.lookingForMembers || false)) payload.lookingForMembers = lookingForMembers;
        if (JSON.stringify(rolesNeeded) !== JSON.stringify(initialProjectData.rolesNeeded || [])) payload.rolesNeeded = rolesNeeded;
        if (coverImageURL.trim() !== (initialProjectData.coverImageURL || '')) payload.coverImageURL = coverImageURL.trim();
        if (projectLink.trim() !== (initialProjectData.projectLink || '')) payload.projectLink = projectLink.trim();
        if (repoLink.trim() !== (initialProjectData.repoLink || '')) payload.repoLink = repoLink.trim();
        if (commentsEnabled !== (initialProjectData.commentsEnabled !== false)) payload.commentsEnabled = commentsEnabled; // Include commentsEnabled (Preserved)

        if (Object.keys(payload).length === 0) {
            // Use Success message for no changes, as per update logic
            setSuccessMessage("No changes detected.");
            setIsSubmitting(false); return;
        }

        try {
            const idToken = await getIdToken(user, true);
            console.log("🔄 Sending PATCH request:", payload);
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`},
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || `Update failed (${response.status})`);
            }

            const result = await response.json();
            console.log("✅ Update successful:", result);
            setSuccessMessage("Project updated successfully! Redirecting...");
            setInitialProjectData(prevData => prevData ? { ...prevData, ...payload } : null);

             // --- Use router.push for reliable navigation (Updated Logic) ---
             const destinationUrl = `/projects/${projectId}`; // Go back to project view page
             console.log(`🚀 Attempting redirect via router.push to: ${destinationUrl}`);
             try {
                 if (router) router.push(destinationUrl);
                 else console.error("Router instance missing.");
                 // Note: No need to setIsSubmitting(false) here if redirect is initiated
             } catch (redirectError: any) {
                 console.error("❌ Redirect error:", redirectError);
                 setError(`Update saved, but redirect failed: ${redirectError.message}`);
                 setIsSubmitting(false); // Allow retry if redirect fails
             }
             // --- End redirect ---

        } catch (err: any) {
            console.error("❌ Failed to submit update:", err);
            setError(err.message || "An unknown error occurred during update.");
            setSuccessMessage(null);
            // Error occurred, ensure submitting is set to false
            setIsSubmitting(false);
        }
        // Removed finally block - handled within try/catch/redirect logic now
    };


     // --- Handlers for Deletion (Preserved) ---
    const requestDeleteProject = () => {
        if (!isOwner) return;
        setDeleteError(null);
        setShowDeleteModal(true);
    };

    const confirmDeleteProject = async () => {
        if (!isOwner || !user || !projectId) {
            setDeleteError("Cannot delete: Not authorized or project ID missing.");
            return;
        }
        setIsDeleting(true);
        setDeleteError(null);
        try {
            const idToken = await getIdToken(user, true);
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to delete project (${response.status})`);
            }
            console.log("Project deleted successfully.");
            setShowDeleteModal(false);
            router.push('/projects'); // Redirect to projects list after deletion
        } catch (err: any) {
            console.error("❌ Failed to delete project:", err);
            setDeleteError(err.message || "An unknown error occurred during deletion.");
        } finally {
            setIsDeleting(false);
        }
    };

    // --- Define shared input styles ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200";
    const selectStyle = "w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200";
    const checkboxStyle = "focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded";


    // --- Render Logic ---
    if (isLoadingData || !authChecked) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Loading...</div>; }
    if (error && (!initialProjectData || !isOwner) && !isSubmitting) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">{error}</p> <Link href="/projects" className="text-blue-600 hover:underline">Back to Projects</Link> </div> ); }
    if (!initialProjectData) { return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Project data unavailable.</div>; }
    if (!isOwner) { return ( <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center"> <p className="text-red-600 mb-4 border border-red-200 bg-red-50 p-4 rounded-md">Permission Denied.</p> <Link href="/projects" className="text-blue-600 hover:underline">Back to Projects</Link> </div> ); }

    // --- Render Edit Form ---
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-black bg-white min-h-screen">
            {/* --- Header --- */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-3 flex-wrap gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                    Edit Project: <span className="font-normal text-gray-600">{initialProjectData.title}</span>
                </h1>
                {/* --- Use Link for Cancel Header --- */}
                <Link href={`/projects/${projectId}`} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                    Cancel & View Project
                 </Link>
            </div>

            {/* --- Form --- */}
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 pb-10">
                {/* Title */}
                <div> <label htmlFor="title" className="...">Project Title <span className="text-red-600">*</span></label> <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputStyle} /> </div>
                {/* Description */}
                <div> <label htmlFor="description" className="...">Description <span className="text-red-600">*</span></label> <textarea id="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required className={inputStyle} /> </div>
                {/* Skills */}
                <div> <label htmlFor="skills" className="...">Skills / Technologies <span className="text-red-600">*</span></label> <input type="text" id="skills" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} required className={inputStyle} placeholder="Comma-separated..." /> <p>...</p> </div>
                {/* Location */}
                <div> <label htmlFor="location" className="...">Location (Optional)</label> <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputStyle} placeholder="e.g., University, City, Remote"/> </div>
                {/* Tech Stack */}
                <div> <label htmlFor="techStack" className="...">Tech Stack Details (Optional)</label> <textarea id="techStack" rows={3} value={techStack} onChange={(e) => setTechStack(e.target.value)} className={inputStyle} placeholder="Architecture, libraries..." /> </div>
                {/* Project Type */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4"> <label htmlFor="projectType" className="...">Project Type <span className="text-red-600">*</span></label> <select id="projectType" value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)} required className={selectStyle}> {projectTypeOptions.map(type => ( <option key={type} value={type}>{type}</option> ))} </select> </div>
                {/* Project Status */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4"> <label htmlFor="status" className="...">Current Status <span className="text-red-600">*</span></label> <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} required className={selectStyle}> {projectStatusOptions.map(s => ( <option key={s} value={s}>{s}</option> ))} </select> </div>
                {/* Cover Image URL */}
                <div> <label htmlFor="coverImageURL" className="...">Cover Image URL (Optional)</label> <input type="url" id="coverImageURL" value={coverImageURL} onChange={(e) => setCoverImageURL(e.target.value)} className={inputStyle} placeholder="https://..." /> </div>
                {/* Project Link */}
                <div> <label htmlFor="projectLink" className="...">Live Project URL (Optional)</label> <input type="url" id="projectLink" value={projectLink} onChange={(e) => setProjectLink(e.target.value)} className={inputStyle} placeholder="https://..." /> </div>
                {/* Repo Link */}
                <div> <label htmlFor="repoLink" className="...">Code Repository URL (Optional)</label> <input type="url" id="repoLink" value={repoLink} onChange={(e) => setRepoLink(e.target.value)} className={inputStyle} placeholder="https://github..." /> </div>
                {/* Looking for Members */}
                <div className="flex items-start pt-2"> <div className="flex items-center h-5"><input id="lookingForMembers" type="checkbox" checked={lookingForMembers} onChange={(e) => setLookingForMembers(e.target.checked)} className={checkboxStyle} /></div> <div className="ml-3 text-sm"><label htmlFor="lookingForMembers" className="...">Open to Collaborators?</label><p className="...">...</p></div> </div>
                {/* Roles Needed */}
                {lookingForMembers && ( <div> <label htmlFor="rolesNeeded" className="...">Roles Needed</label> <input type="text" id="rolesNeeded" value={rolesNeededInput} onChange={(e) => setRolesNeededInput(e.target.value)} className={inputStyle} placeholder="Comma-separated..." /> <p>...</p> </div> )}
                {/* Comments Enabled Toggle (Preserved) */}
                 <div className="flex items-start pt-2"> <div className="flex items-center h-5"> <input id="commentsEnabled" type="checkbox" checked={commentsEnabled} onChange={(e) => setCommentsEnabled(e.target.checked)} className={checkboxStyle} /> </div> <div className="ml-3 text-sm"> <label htmlFor="commentsEnabled" className="font-medium text-gray-700">Enable Comments</label> <p className="text-xs text-gray-500">Allow users to comment.</p> </div> </div>

                {/* Feedback Area */}
                <div className='min-h-[40px] pt-2'>
                    {error && !successMessage && ( <p className="text-sm text-red-600 p-2 bg-red-50 border border-red-200 rounded">Error: {error}</p> )}
                    {successMessage && ( <p className="text-sm text-green-600 p-2 bg-green-50 border border-green-200 rounded">{successMessage}</p> )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button type="submit" disabled={isSubmitting || !isOwner || !!successMessage} /* Disable after success msg */ className="order-1 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"> {isSubmitting ? 'Saving...' : 'Save Changes'} </button>
                    {/* --- Use Link for Cancel Button --- */}
                    <Link href={`/projects/${projectId}`} legacyBehavior>
                        <a className="order-2 w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"> Cancel </a>
                    </Link>
                    {/* Delete Button (Preserved) */}
                    <button type="button" onClick={requestDeleteProject} disabled={isDeleting || !isOwner} className="order-3 sm:ml-auto w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"> Delete Project </button>
                </div>
            </form>

            {/* Delete Confirmation Modal (Preserved) */}
             {showDeleteModal && (
                 <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                     <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                         <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
                         <p className="text-sm text-gray-600 mb-1"> Delete project: <span className="font-medium">{initialProjectData?.title}</span>? </p>
                         <p className="text-sm text-red-600 mb-4">This action cannot be undone.</p>
                         {deleteError && ( <p className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded-md mb-4">Error: {deleteError}</p> )}
                         <div className="flex justify-end gap-3 mt-6">
                             <button type="button" onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="..."> Cancel </button>
                             <button type="button" onClick={confirmDeleteProject} disabled={isDeleting} className="..."> {isDeleting ? 'Deleting...' : 'Delete Project'} </button>
                         </div>
                     </div>
                 </div>
             )}

        </div> // Close main container
    );
}