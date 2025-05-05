// components/EditExperienceForm.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth'; // Assuming you pass currentUser
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for new items
import { format } from 'date-fns'; // For formatting dates from DB for input
import { Timestamp } from 'firebase/firestore'; // For type checking dates from DB

// Define the shape of a single experience item
// (Should match the type in your main profile interface)
interface ExperienceItem {
    id: string; // Unique ID for React key and potential deletion
    company: string;
    title: string;
    location?: string | null;
    startDate?: string; // Store as 'YYYY-MM-DD' in state for <input type="date">
    endDate?: string; // Store as 'YYYY-MM-DD' or 'Present' in state
    description: string;
}

// Define the props for the form component
interface EditExperienceFormProps {
    currentUser: User | null;
    // Expect array from profileData, ensure it's initialized properly if null/undefined
    initialExperience: Array<{
        id: string;
        company: string;
        title: string;
        location?: string | null;
        startDate?: any; // Accepts Timestamp, Date, string from DB
        endDate?: any;   // Accepts Timestamp, Date, string, 'Present' from DB
        description: string;
    }>;
    onSuccess: () => void; // Call on successful save
    onCancel: () => void;  // Call on cancel
}

// --- Helper function to format dates for <input type="date"> ---
// (Consider moving to lib/dateUtils.ts)
function formatInputDate(date: any): string {
     if (!date || date === 'Present') return ''; // Don't format 'Present' or null/undefined
     try {
         let d: Date;
         if (date instanceof Timestamp) { d = date.toDate(); }
         else if (date instanceof Date) { d = date; }
         else { d = new Date(date); } // Attempt to parse string

         // Check if the resulting date is valid before formatting
         if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');

     } catch (e) { console.warn("Input Date formatting error:", date, e); }
     return ''; // Return empty string if formatting fails or date is invalid
}

const EditExperienceForm: React.FC<EditExperienceFormProps> = ({
    currentUser,
    initialExperience,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data, formatting dates for inputs
    const [experiences, setExperiences] = useState<ExperienceItem[]>(() =>
        (initialExperience || []).map(exp => ({
            id: exp.id || uuidv4(), // Ensure every item has an ID, generate if missing
            company: exp.company || '',
            title: exp.title || '',
            location: exp.location || '',
            startDate: formatInputDate(exp.startDate), // Format dates
            endDate: exp.endDate === 'Present' ? 'Present' : formatInputDate(exp.endDate), // Handle 'Present' & Format
            description: exp.description || '',
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific experience item's input fields
    const handleItemChange = (index: number, field: keyof ExperienceItem, value: string | boolean) => { // Allow boolean for checkbox
        const updatedExperiences = [...experiences];
        const currentItem = updatedExperiences[index];

        // Handle the 'endDate' checkbox specifically
        if (field === 'endDate' && typeof value === 'boolean') {
            currentItem.endDate = value ? 'Present' : ''; // Set to 'Present' or clear the date string
        } else if (typeof value === 'string') { // Handle regular string inputs
            // Use type assertion carefully
            (currentItem as any)[field] = value;
        } else {
             console.warn("Unexpected value type in handleItemChange:", field, value);
        }

        setExperiences(updatedExperiences);
    };


    // Add a new blank experience item to the list
    const addExperienceItem = () => {
        const newItem: ExperienceItem = {
            id: uuidv4(), // Generate unique ID
            company: '', title: '', location: '',
            startDate: '', endDate: '', description: ''
        };
        setExperiences(prev => [...prev, newItem]);

        // Optional: scroll the form to the new item after state updates
        setTimeout(() => {
             // Use the newly generated ID to find the element
             const newItemElement = window.document.getElementById(`experience-item-${newItem.id}`);
             newItemElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             // Try focusing the first input of the new item
             (newItemElement?.querySelector('input[type="text"]') as HTMLElement)?.focus();
        }, 100); // Short delay to allow DOM update
    };

    // Remove an experience item from the list by its index
    const removeExperienceItem = (indexToRemove: number) => {
        const item = experiences[indexToRemove];
        // Ask confirmation only if item has some content
        if (item && (item.company || item.title || item.description)) {
            if (!confirm("Remove this experience entry?")) return;
        }
        setExperiences(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }

        setIsSubmitting(true);
        setError(null);

        // Prepare data for backend: Ensure empty dates are null, keep 'Present' as string
        // Filter out entries where both title and company are empty
        const experiencesToSave = experiences
            .filter(exp => exp.title?.trim() || exp.company?.trim())
            .map(exp => ({
                id: exp.id, // Keep the ID
                company: exp.company.trim(),
                title: exp.title.trim(),
                location: exp.location?.trim() || null, // Send null if empty
                startDate: exp.startDate || null,
                // Keep 'Present' as string, otherwise use date string or null
                endDate: exp.endDate === 'Present' ? 'Present' : (exp.endDate || null),
                description: exp.description.trim(),
            }));

        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                // Send the entire updated 'experience' array under the correct key
                body: JSON.stringify({ experience: experiencesToSave }),
            });

            if (!response.ok) {
                const d = await response.json().catch(()=>{ return { message: 'Failed to save experience. Unknown error.' }});
                throw new Error(d.message || 'Failed to update experience');
            }

            console.log("Experience updated successfully");
            onSuccess(); // Close modal and refetch data

        } catch (err) {
            console.error("Error updating experience:", err);
            setError((err as Error).message);
            setIsSubmitting(false); // Keep modal open on error
        }
    };

    // Base input style
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";

    return (
        // Form for the entire experience section
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto"> {/* Make form scrollable */}
            {/* Modal Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Experience</h3>
                 {/* Close button should be handled by parent Modal */}
            </div>

            {/* List of Editable Experience Items */}
            <div className='space-y-6'>
                {experiences.length === 0 && (
                    <p className="text-center text-gray-500 italic py-4">No experience added yet. Click "Add Experience" below to start.</p>
                )}
                {experiences.map((exp, index) => (
                    // Use item's unique ID for the key and the container ID
                    <div key={exp.id} id={`experience-item-${exp.id}`} className="p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
                        <button
                            type="button"
                            onClick={() => removeExperienceItem(index)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors z-10" // Ensure button is clickable
                            aria-label="Remove experience entry"
                        >
                            <Trash2 size={16} />
                        </button>

                        {/* Form Fields for one Experience item */}
                        <div>
                            <label htmlFor={`title-${exp.id}`} className={labelStyle}>Title*</label>
                            <input type="text" id={`title-${exp.id}`} required value={exp.title} onChange={(e) => handleItemChange(index, 'title', e.target.value)} className={inputBaseStyle} />
                        </div>
                        <div>
                            <label htmlFor={`company-${exp.id}`} className={labelStyle}>Company*</label>
                            <input type="text" id={`company-${exp.id}`} required value={exp.company} onChange={(e) => handleItemChange(index, 'company', e.target.value)} className={inputBaseStyle} />
                        </div>
                         <div> {/* Location now full width */}
                             <label htmlFor={`location-${exp.id}`} className={labelStyle}>Location</label>
                             <input type="text" id={`location-${exp.id}`} value={exp.location || ''} onChange={(e) => handleItemChange(index, 'location', e.target.value)} className={inputBaseStyle} placeholder="e.g., City, State or Remote" />
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor={`startDate-${exp.id}`} className={labelStyle}>Start Date</label>
                                <input type="date" id={`startDate-${exp.id}`} value={exp.startDate || ''} onChange={(e) => handleItemChange(index, 'startDate', e.target.value)} className={inputBaseStyle} />
                            </div>
                            <div>
                                 <label htmlFor={`endDate-${exp.id}`} className={labelStyle}>End Date</label>
                                 <input
                                    type="date"
                                    id={`endDate-${exp.id}`}
                                    value={exp.endDate === 'Present' ? '' : exp.endDate || ''} // Clear date value if 'Present'
                                    onChange={(e) => handleItemChange(index, 'endDate', e.target.value)} // Pass string value
                                    className={`${inputBaseStyle}`}
                                    disabled={exp.endDate === 'Present'} // Disable if checkbox checked
                                />
                                  <label className='flex items-center mt-1.5 cursor-pointer'>
                                     <input
                                        type='checkbox'
                                        checked={exp.endDate === 'Present'}
                                        // Pass boolean checked state to handler
                                        onChange={(e) => handleItemChange(index, 'endDate', e.target.checked)}
                                        className='h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3]'
                                     />
                                     <span className='ml-2 text-sm text-gray-700'>I currently work here</span>
                                  </label>
                             </div>
                         </div>
                        <div>
                            <label htmlFor={`description-${exp.id}`} className={labelStyle}>Description</label>
                            <textarea id={`description-${exp.id}`} rows={4} value={exp.description || ''} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className={inputBaseStyle + ' min-h-[80px]'} placeholder="Describe your responsibilities and achievements using bullet points (Markdown supported)..."></textarea>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add New Experience Button */}
            <button
                type="button"
                onClick={addExperienceItem}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3] transition-colors"
            >
                <PlusCircle size={16}/> Add Another Experience
            </button>

            {/* Submission Area (Sticky Footer) */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>} {/* Error message aligned left */}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-32"> {/* Wider Save button */}
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Experience'}
                </button>
            </div>
        </form>
    );
};

export default EditExperienceForm;