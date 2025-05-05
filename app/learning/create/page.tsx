// app/learning/create/page.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

const MIN_HEIGHT_CONTENT = 'min-h-[calc(100vh-4rem-2rem)]';

// Predefined options for dropdowns
const academicYearOptions = ['2024-25', '2023-24', '2022-23', '2021-22', '2020-21']; // Example years

// --- Updated Year Options with Full Forms ---
const yearOptions = [
    { value: 'FY', label: 'FY (1st Year)' },
    { value: 'SY', label: 'SY (2nd Year)' },
    { value: 'TY', label: 'TY (3rd Year)' },
    { value: 'LY', label: 'LY (4th Year)' },
];

const semesterOptions = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8']; // Example semesters

// --- Updated Learning Type Options with Full Forms and Custom Option ---
const learningTypeOptions = [
    { value: 'PBL', label: 'PBL (Project Based Learning)' },
    { value: 'SBL', label: 'SBL (Skill Based Learning)' },
    { value: 'TBL', label: 'TBL (Tasked Based Learning)' },
    { value: 'Custom', label: 'Custom Type...' }, // Option to enter a custom type
];

const CreateLearningClassroomPage: React.FC = () => {
    const { currentUser, isAuthLoading, isProfileLoading } = useAuth();
    const router = useRouter();

    // --- Form State ---
    const [formData, setFormData] = useState({
        name: '',
        academicYear: academicYearOptions[0] || '',
        year: yearOptions[0]?.value || '', // Use the 'value' from the first year option
        semester: semesterOptions[0] || '',
        branch: '',
        batch: '',
        learningType: learningTypeOptions[0]?.value || '', // Use the 'value' from the first learning type option
        description: '',
        commentsEnabled: true,
    });
    // --- State for Custom Learning Type Input ---
    const [customLearningTypeText, setCustomLearningTypeText] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // --- Auth Check ---
    if (isAuthLoading || isProfileLoading) {
        return (
             <div className={`flex justify-center items-center pt-16 ${MIN_HEIGHT_CONTENT}`}>
                <LoadingSpinner />
             </div>
        );
    }

    if (!currentUser) {
        return (
             <div className={`container mx-auto px-4 py-8 mt-16 text-center ${MIN_HEIGHT_CONTENT}`}>
                 <h1 className="text-2xl font-bold text-red-700 mb-4">Unauthorized</h1>
                 <p className="text-gray-600 mb-4">You must be logged in to create a learning page.</p>
                 <Link href="/" className="text-blue-600 hover:underline">Go to home page (Login)</Link>
             </div>
        );
    }

    // --- Input Change Handler ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
        } else {
             // Special handling for learningType select change
             if (name === 'learningType') {
                 setFormData({ ...formData, [name]: value });
                 // If the user switches *away* from 'Custom', clear the custom text state
                 if (value !== 'Custom') {
                     setCustomLearningTypeText('');
                 }
             } else {
                setFormData({ ...formData, [name]: value });
             }
        }
        setError(null);
        setSuccessMessage(null);
    };

    // --- Custom Learning Type Input Change Handler ---
    const handleCustomTypeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomLearningTypeText(e.target.value);
        setError(null); // Clear error on input change
        setSuccessMessage(null);
    };


    // --- Form Submit Handler ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        // Basic client-side validation for required fields
        if (!formData.name.trim() || !formData.academicYear || !formData.year || !formData.semester || !formData.branch || !formData.learningType) {
             setError('Please fill out all required fields.');
             setIsSubmitting(false);
             return;
        }

        // --- Additional Validation for Custom Learning Type ---
        if (formData.learningType === 'Custom' && !customLearningTypeText.trim()) {
             setError('Please specify the custom learning type.');
             setIsSubmitting(false);
             return;
        }

        // --- Prepare data payload ---
        // Use the custom text if 'Custom' is selected, otherwise use the selected value
        const learningTypePayload = formData.learningType === 'Custom'
                                      ? customLearningTypeText.trim()
                                      : formData.learningType;

        const payload = {
             ...formData, // Include all other form data
             learningType: learningTypePayload, // Use the determined learning type value
        };

        try {
            const idToken = await currentUser.getIdToken(true);

            console.log("Submitting learning page data:", payload); // Log with new terminology

            const response = await fetch('/api/learning-classrooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify(payload), // Send the prepared payload
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const apiError = errorBody.message || `Failed to create learning page (${response.status})`;
                throw new Error(apiError);
            }

            const result = await response.json();
            console.log("Learning page created successfully:", result);

            setSuccessMessage(result.message || 'Learning page created!');
            setTimeout(() => {
                 router.push(`/learning/${result.classroomId}`);
            }, 1500);

        } catch (err: any) {
            console.error('❌ Error creating learning page:', err);
            setError(err.message || 'Could not create learning page.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Render Form ---
    return (
        <div className={`container mx-auto px-4 py-8 mt-16 max-w-2xl ${MIN_HEIGHT_CONTENT}`}>
            <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Create New Learning Page</h1>

            {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
            {successMessage && (
                 <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
                     <strong className="font-bold mr-1">Success:</strong>
                     <span className="block sm:inline">{successMessage}</span>
                 </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-5">

                {/* Learning Page Name (Required) */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Learning Page Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                        placeholder="e.g., 2023-24-PBL Group A - Smart City Project"
                    />
                     <p className="mt-1 text-xs text-gray-500">Give your learning page a clear and descriptive name.</p>
                </div>

                 {/* Key Academic & Learning Details */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="academicYear" className="block text-sm font-medium text-gray-700 mb-1">Academic Year <span className="text-red-500">*</span></label>
                         <select
                            id="academicYear"
                            name="academicYear"
                            value={formData.academicYear}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                         >
                            {academicYearOptions.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                         </select>
                     </div>
                      <div>
                        <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">Year <span className="text-red-500">*</span></label>
                         <select
                            id="year"
                            name="year"
                            value={formData.year}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                         >
                             {/* Map over yearOptions array of objects */}
                             {yearOptions.map(option => (
                                 <option key={option.value} value={option.value}>{option.label}</option>
                             ))}
                         </select>
                     </div>
                     <div>
                        <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-1">Semester <span className="text-red-500">*</span></label>
                         <select
                            id="semester"
                            name="semester"
                            value={formData.semester}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                         >
                             {semesterOptions.map(sem => (
                                 <option key={sem} value={sem}>{sem}</option>
                             ))}
                         </select>
                     </div>
                      <div>
                        <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
                         <input
                            type="text"
                            id="branch"
                            name="branch"
                            value={formData.branch}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                            placeholder="e.g., CSE"
                        />
                     </div>
                     {/* Learning Type Dropdown */}
                     <div className="col-span-1 sm:col-span-2">
                         <label htmlFor="learningType" className="block text-sm font-medium text-gray-700 mb-1">Learning Type <span className="text-red-500">*</span></label>
                         <select
                            id="learningType"
                            name="learningType"
                            value={formData.learningType}
                            onChange={handleInputChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                         >
                             {/* Map over learningTypeOptions array of objects */}
                             {learningTypeOptions.map(option => (
                                 <option key={option.value} value={option.value}>{option.label}</option>
                             ))}
                         </select>
                         {/* --- Conditional Input for Custom Type --- */}
                         {formData.learningType === 'Custom' && (
                             <div className="mt-2">
                                 <label htmlFor="customLearningTypeText" className="sr-only">Custom Type Name</label>
                                 <input
                                    type="text"
                                    id="customLearningTypeText"
                                    name="customLearningTypeText" // Use a different name for custom type state
                                    value={customLearningTypeText}
                                    onChange={handleCustomTypeInputChange} // Use the specific handler
                                    required={formData.learningType === 'Custom'} // Make required only if custom is selected
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSubmitting}
                                    placeholder="Specify custom type (e.g., Design Thinking)"
                                 />
                             </div>
                         )}
                     </div>
                 </div>

                 {/* Optional Details (Batch) */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="batch" className="block text-sm font-medium text-gray-700 mb-1">Batch / Group (Optional)</label>
                         <input
                            type="text"
                            id="batch"
                            name="batch"
                            value={formData.batch}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                            placeholder="e.g., Batch 1"
                        />
                     </div>
                 </div>

                 {/* Description (Optional) */}
                 <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                        placeholder="Provide a brief description for this learning page."
                    />
                </div>

                 {/* Settings */}
                 <div className="pt-4 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Settings</h3>
                       <div className="flex items-center">
                           <input
                                type="checkbox"
                                id="commentsEnabled"
                                name="commentsEnabled"
                                checked={formData.commentsEnabled}
                                onChange={handleInputChange}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmitting}
                           />
                           <label htmlFor="commentsEnabled" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                                Enable Q&A / Comments Chat
                           </label>
                       </div>
                 </div>


                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-6">
                    <Link href="/learning" className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus-within:ring-2 focus:ring-offset-2 focus-within:ring-offset-2 focus:ring-gray-400 focus-within:ring-gray-400 transition duration-150 text-sm flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none" aria-disabled={isSubmitting}>
                         Cancel
                    </Link>

                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 text-sm font-medium flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isSubmitting || !formData.name.trim() || !formData.academicYear || !formData.year || !formData.semester || !formData.branch || !formData.learningType || (formData.learningType === 'Custom' && !customLearningTypeText.trim())} // Disable if submitting or required fields are empty (including custom type)
                    >
                        {isSubmitting ? (
                             <svg className="animate-spin h-4 w-4 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         ) : null}
                        {isSubmitting ? 'Creating...' : 'Create Learning Page'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateLearningClassroomPage;