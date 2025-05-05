// app/resources/create/page.tsx
"use client";

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import app from '@/app/firebase'; // Your Firebase client app instance
import Link from 'next/link';
import { ResourceType } from '@/lib/types/resource'; // Import Resource types

// Define available options based on the ResourceType union type
const resourceTypeOptions: ResourceType[] = [
    'Notes',
    'Question Bank',
    'Research Paper',
    'Video',
    'Link Collection',
    'Book PDF',
    'Presentation',
    'Code Repository',
    'Other'
];

export default function CreateResourcePage() {
    const router = useRouter();
    const auth = getAuth(app);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false); // For form submission
    const [error, setError] = useState<string | null>(null); // For submission errors
    const [authChecked, setAuthChecked] = useState(false); // Track initial auth check

    // --- Form State ---
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [linkURL, setLinkURL] = useState(''); // State for external Link URL
    const [resourceType, setResourceType] = useState<ResourceType>(resourceTypeOptions[0]); // Default
    const [branch, setBranch] = useState('');
    const [year, setYear] = useState('');
    const [college, setCollege] = useState('');
    const [subject, setSubject] = useState('');
    const [tagsInput, setTagsInput] = useState(''); // Input for comma-separated tags

    // --- Check Auth State ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthChecked(true);
            if (!currentUser && authChecked) {
                console.log("Create Resource Page: User not logged in, redirecting...");
                router.push('/resources'); // Redirect to resource list (or login)
            }
        });
        return () => unsubscribe();
    }, [auth, router, authChecked]);


    // --- Handle Form Submission (Sends JSON) ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (!user) {
            setError("You must be logged in to share a resource.");
            return;
        }

        // *** Client-side Validation ***
        if (!title.trim()) {
             setError("Please enter a title for the resource.");
             return;
        }
        if (!linkURL.trim()) {
             setError("Please provide a valid URL for the resource.");
             return;
        }
        // Basic URL format check
        try {
            new URL(linkURL.trim()); // Test if it's a valid URL structure
        } catch (_) {
            setError("The provided URL format seems invalid. Please include http:// or https://");
            return;
        }

        setIsLoading(true);

        // Prepare JSON data payload for the API
        const resourceData = {
            title: title.trim(),
            description: description.trim(),
            linkURL: linkURL.trim(), // Send the user-provided URL
            resourceType: resourceType,
            branch: branch.trim(),
            year: year.trim(),
            college: college.trim(),
            subject: subject.trim(),
            // Send tags as array, filtering out empty strings
            tags: tagsInput.trim().split(',').map(tag => tag.trim()).filter(Boolean),
        };


        try {
            // Get the Firebase ID token for authentication
            const idToken = await getIdToken(user);

            console.log("Submitting new resource data (JSON):", JSON.stringify(resourceData, null, 2));

            // Send POST request using JSON
            const response = await fetch('/api/resources', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json', // Set Content-Type
                    'Authorization': `Bearer ${idToken}`, // Send auth token
                },
                body: JSON.stringify(resourceData), // Send JSON data
            });

            // Handle non-successful responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error
                // Use the error format from the API ({ error: ..., details: ... })
                throw new Error(errorData.error || `Failed to create resource (${response.status}): ${errorData.details || 'Unknown API error'}`);
            }

            // Handle successful response
            const result = await response.json(); // Expect { message: string, resourceId: string }
            console.log("Resource created successfully:", result);

            // Redirect to the main resources list page after successful creation
            console.log(`🚀 Redirecting to resources list: /resources`);
            router.push('/resources');

        } catch (err: any) {
            console.error("❌ Failed to submit resource:", err);
            setError(err.message || "An unknown error occurred.");
            setIsLoading(false); // Ensure loading stops on error
        }
    };

    // --- Define shared input styles ---
    const inputStyle = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200 text-gray-900"; // Added text-gray-900
    const selectStyle = "w-full sm:w-auto bg-white border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200 text-gray-900"; // Added text-gray-900

    // --- Render Logic ---
    if (!authChecked) {
        return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-gray-500">Checking authentication...</div>;
    }
    if (!user) {
        return <div className="container mx-auto px-4 py-8 pt-20 md:pt-24 text-center text-red-600">Please log in to share a resource. Redirecting...</div>;
    }

    return (
        // Added background color and text color for better visibility
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 md:pt-24 text-gray-900 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b border-gray-200 pb-3">
                Share New Resource
            </h1>

            {/* Added bg-white and padding to form container */}
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-5 p-6 sm:p-8 bg-white rounded-lg shadow-md">
                {/* Title */}
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Resource Title <span className="text-red-600">*</span></label>
                    <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputStyle} placeholder="e.g., Advanced Calculus Midterm Notes"/>
                </div>

                 {/* Link URL Input (Replaces File Input) */}
                 <div>
                    <label htmlFor="linkURL" className="block text-sm font-medium text-gray-700 mb-1">Resource Link (URL) <span className="text-red-600">*</span></label>
                    <input
                        type="url" // Use type="url" for better browser handling/validation
                        id="linkURL"
                        value={linkURL}
                        onChange={(e) => setLinkURL(e.target.value)}
                        required
                        className={inputStyle}
                        placeholder="https://docs.google.com/document/d/... or https://github.com/..."
                    />
                     <p className="text-xs text-gray-500 mt-1">Paste the direct link to your resource (e.g., Google Drive, GitHub).</p>
                </div>


                {/* Description */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputStyle} placeholder="Add context: course code, topics covered..." />
                </div>

                {/* Resource Type */}
                <div className='flex flex-col sm:flex-row sm:items-center sm:gap-4'>
                    <label htmlFor="resourceType" className="block text-sm font-medium text-gray-700 mb-1 sm:mb-0 flex-shrink-0">Resource Type <span className="text-red-600">*</span></label>
                    <select id="resourceType" value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType)} required className={selectStyle}>
                        {resourceTypeOptions.map(type => ( <option key={type} value={type}>{type}</option> ))}
                    </select>
                </div>

                <hr className="my-4 border-gray-200"/>
                 <h2 className="text-lg font-semibold text-gray-700 mb-3">Categorization (Optional but helpful)</h2>

                 {/* Branch */}
                 <div>
                    <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">Branch / Department</label>
                    <input type="text" id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={inputStyle} placeholder="e.g., Computer Science, Electrical Eng."/>
                 </div>

                 {/* Year */}
                 <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                    <input type="text" id="year" value={year} onChange={(e) => setYear(e.target.value)} className={inputStyle} placeholder="e.g., 1st Year, 3rd Sem, Graduate"/>
                 </div>

                 {/* College / University */}
                 <div>
                    <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-1">College / University</label>
                    <input type="text" id="college" value={college} onChange={(e) => setCollege(e.target.value)} className={inputStyle} placeholder="e.g., IIT Bombay, MIT Online"/>
                 </div>

                 {/* Subject */}
                 <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject / Course Code</label>
                    <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputStyle} placeholder="e.g., Data Structures, CS201"/>
                 </div>

                 {/* Tags */}
                 <div>
                    <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input type="text" id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputStyle} placeholder="e.g., algorithms, midterm, important (comma-separated)" />
                    <p className="text-xs text-gray-500 mt-1">Enter relevant keywords separated by commas.</p>
                </div>


                {/* Error Message Display */}
                {error && (
                    <div className="my-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* Submit Button */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-gray-200 mt-6">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        {isLoading ? 'Creating...' : 'Create Resource'}
                    </button>
                    {/* Cancel Button */}
                    <Link href="/resources" legacyBehavior>
                        <a className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                            Cancel
                        </a>
                    </Link>
                </div>
            </form>
        </div>
    );
}