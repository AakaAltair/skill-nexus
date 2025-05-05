// app/projects/create/page.tsx
"use client";

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use App Router's navigation
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth'; // Import getIdToken
import app from '@/app/firebase';
import Link from 'next/link';
import { ProjectType, ProjectStatus } from '@/lib/types/project';

// Define available options
const projectTypeOptions: ProjectType[] = ["Personal", "College Course", "Department Initiative", "Competition", "Research", "Open Source Contribution", "Startup Idea", "Tutorial/Example", "Other"];
const projectStatusOptions: ProjectStatus[] = ["Idea", "Planning", "In Progress", "Paused", "Completed"]; // Exclude 'Archived' for creation

export default function CreateProjectPage() {
    const router = useRouter();
    const auth = getAuth(app);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false); // For form submission
    const [error, setError] = useState<string | null>(null); // For submission errors
    const [authChecked, setAuthChecked] = useState(false); // Track if initial auth check is done

    // --- Form State ---
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [skillsInput, setSkillsInput] = useState(''); // Input for comma-separated skills
    const [projectType, setProjectType] = useState<ProjectType>(projectTypeOptions[0]); // Default
    const [status, setStatus] = useState<ProjectStatus>(projectStatusOptions[0]); // Default
    const [location, setLocation] = useState(''); // Location state
    const [techStack, setTechStack] = useState('');
    const [lookingForMembers, setLookingForMembers] = useState(false);
    const [rolesNeededInput, setRolesNeededInput] = useState('');
    const [coverImageURL, setCoverImageURL] = useState('');
    const [projectLink, setProjectLink] = useState('');
    const [repoLink, setRepoLink] = useState('');

    // --- Check Auth State ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true); // Mark check complete
            // Redirect immediately if auth check is done and there's no user
            if (!currentUser && authChecked) {
                 console.log("Create Page: User not logged in after check, redirecting...");
                 router.push('/projects'); // Or your login page
            }
        });
        // Cleanup listener on unmount
        return () => unsubscribe();
    }, [auth, router, authChecked]); // Added authChecked dependency


    // --- Handle Form Submission ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent default browser submission
        setError(null); // Clear previous errors

        // Ensure user is logged in before attempting submission
        if (!user) {
            setError("You must be logged in to create a project.");
            return;
        }

        setIsLoading(true); // Indicate submission start

        // Basic client-side validation
        const skills = skillsInput.split(',').map(skill => skill.trim()).filter(Boolean);
        if (!title.trim() || !description.trim() || skills.length === 0) {
            setError("Please fill in Title, Description, and at least one Skill.");
            setIsLoading(false); // Stop loading
            return;
        }
        const rolesNeeded = rolesNeededInput.split(',').map(role => role.trim()).filter(Boolean);

        // Prepare data payload for the API
        const projectData = {
            title: title.trim(),
            description: description.trim(),
            skills: skills,
            projectType: projectType,
            status: status,
            location: location.trim(), // Include location
            techStack: techStack.trim(),
            lookingForMembers: lookingForMembers,
            rolesNeeded: rolesNeeded,
            coverImageURL: coverImageURL.trim(),
            projectLink: projectLink.trim(),
            repoLink: repoLink.trim(),
        };

        try {
            // Get the Firebase ID token for authentication
            const idToken = await getIdToken(user); // No need to force refresh usually on create

            console.log("Submitting new project data:", projectData);

            // Send POST request to the backend API
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`, // Send auth token
                },
                body: JSON.stringify(projectData),
            });

            // Handle non-successful responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error
                throw new Error(errorData.error || errorData.details || `Failed to create project (${response.status})`);
            }

            // Handle successful response
            const result = await response.json(); // Expect { message: string, projectId: string }
            console.log("Project created successfully:", result);

            // --- Corrected Redirect Logic ---
            if (result.projectId) {
                 const destinationUrl = `/projects/${result.projectId}`;
                 console.log(`🚀 Redirecting to NEW project page: ${destinationUrl}`);
                 router.push(destinationUrl); // Redirect to the newly created project's page
            } else {
                 console.log(`🚀 Redirecting to projects list (fallback): /projects`);
                 router.push('/projects'); // Fallback redirect to the main projects list
            }
            // No need for setTimeout usually after create

        } catch (err: any) {
            console.error("❌ Failed to submit project:", err);
            setError(err.message || "An unknown error occurred.");
             setIsLoading(false); // Ensure loading stops on error
        }
        // Note: setIsLoading(false) is handled in the finally block or on error/redirect.
        // If redirect works, the component unmounts, so setting state might not be necessary.
    };


    // --- Define shared input styles ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200";
    const selectStyle = "w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200";


    // Display loading state until auth check is complete
    if (!authChecked) {
         return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Checking authentication...</div>;
    }
    // If auth is checked but no user, show message (redirect effect will kick in)
    if (!user) {
        return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-red-600">Please log in to create a project. Redirecting...</div>;
    }

    // --- Render Form ---
    return (
        // Adjust top padding based on navbar height
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-black bg-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b border-gray-200 pb-3">
                Create New Project
            </h1>

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5 pb-10">
                {/* Title */}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Project Title <span className="text-red-600">*</span></label>
                    <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputStyle} placeholder="e.g., AI Recipe Generator"/>
                </div>

                {/* Description */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-600">*</span></label>
                    <textarea id="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required className={inputStyle} placeholder="Describe your project goals, features..." />
                </div>

                 {/* Skills */}
                 <div>
                    <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">Skills / Technologies Needed <span className="text-red-600">*</span></label>
                    <input type="text" id="skills" value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} required className={inputStyle} placeholder="e.g., React, Node.js, Python, Firebase (comma-separated)" />
                    <p className="text-xs text-gray-500 mt-1">Enter skills separated by commas.</p>
                </div>

                 {/* Location Input */}
                 <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
                    <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputStyle} placeholder="e.g., University Name, City, Remote"/>
                 </div>

                 {/* Tech Stack Details */}
                 <div>
                    <label htmlFor="techStack" className="block text-sm font-medium text-gray-700 mb-1">Tech Stack Details (Optional)</label>
                    <textarea id="techStack" rows={3} value={techStack} onChange={(e) => setTechStack(e.target.value)} className={inputStyle} placeholder="Describe architecture, specific libraries..." />
                 </div>

                 {/* Project Type */}
                <div className='flex flex-col sm:flex-row sm:items-center sm:gap-4'>
                     <label htmlFor="projectType" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-0 flex-shrink-0">Project Type <span className="text-red-600">*</span></label>
                    <select id="projectType" value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectType)} required className={selectStyle}>
                        {projectTypeOptions.map(type => ( <option key={type} value={type}>{type}</option> ))}
                    </select>
                </div>

                 {/* Project Status */}
                 <div className='flex flex-col sm:flex-row sm:items-center sm:gap-4'>
                     <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-0 flex-shrink-0">Current Status <span className="text-red-600">*</span></label>
                    <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} required className={selectStyle}>
                        {projectStatusOptions.map(s => ( <option key={s} value={s}>{s}</option> ))}
                    </select>
                </div>

                {/* Cover Image URL */}
                <div>
                    <label htmlFor="coverImageURL" className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL (Optional)</label>
                    <input type="url" id="coverImageURL" value={coverImageURL} onChange={(e) => setCoverImageURL(e.target.value)} className={inputStyle} placeholder="https://example.com/image.png" />
                     {/* Placeholder for future upload button */}
                </div>

                {/* Project Link */}
                 <div>
                    <label htmlFor="projectLink" className="block text-sm font-medium text-gray-700 mb-1">Live Project URL (Optional)</label>
                    <input type="url" id="projectLink" value={projectLink} onChange={(e) => setProjectLink(e.target.value)} className={inputStyle} placeholder="https://myproject-demo.com" />
                </div>

                 {/* Repo Link */}
                 <div>
                    <label htmlFor="repoLink" className="block text-sm font-medium text-gray-700 mb-1">Code Repository URL (Optional)</label>
                    <input type="url" id="repoLink" value={repoLink} onChange={(e) => setRepoLink(e.target.value)} className={inputStyle} placeholder="https://github.com/user/repo" />
                </div>

                 {/* Looking for Members */}
                 <div className="flex items-start pt-2">
                    <div className="flex items-center h-5">
                        <input id="lookingForMembers" type="checkbox" checked={lookingForMembers} onChange={(e) => setLookingForMembers(e.target.checked)} className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded" />
                    </div>
                    <div className="ml-3 text-sm">
                         <label htmlFor="lookingForMembers" className="font-medium text-gray-700">Open to Collaborators?</label>
                         <p className="text-xs text-gray-500">Check if you are looking for others to join.</p>
                    </div>
                 </div>

                 {/* Roles Needed (Conditional) */}
                 {lookingForMembers && (
                     <div>
                        <label htmlFor="rolesNeeded" className="block text-sm font-medium text-gray-700 mb-1">Roles Needed (Optional)</label>
                        <input type="text" id="rolesNeeded" value={rolesNeededInput} onChange={(e) => setRolesNeededInput(e.target.value)} className={inputStyle} placeholder="Comma-separated, e.g., UI Designer" />
                         <p className="text-xs text-gray-500 mt-1">Enter desired roles separated by commas.</p>
                    </div>
                 )}


                {/* Error Message Display */}
                {error && (
                    <p className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded-md"> {/* Red accent */}
                        Error: {error}
                    </p>
                )}

                {/* Submit Button */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                        type="submit"
                        disabled={isLoading} // Disable while submitting
                        className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" // Blue accent button
                    >
                        {isLoading ? 'Creating...' : 'Create Project'}
                    </button>
                    {/* Cancel Button (Links back to projects list) */}
                    <Link href="/projects" legacyBehavior>
                        <a className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                            Cancel
                        </a>
                    </Link>
                </div>
            </form>
        </div>
    );
}