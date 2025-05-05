// components/EditSkillsForm.tsx
"use client";

import React, { useState, FormEvent, KeyboardEvent, useMemo } from 'react'; // Added useMemo
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Define the shape of a single skill item
interface SkillItem {
    id: string;
    name: string;
    category: string; // e.g., "Programming Language", "Framework", "Tool", "Soft Skill"
}

// Define available categories (could be fetched or configured)
// Keep this list sorted for consistent display
const SKILL_CATEGORIES = [
    "Programming Language",
    "Framework/Library",
    "Database",
    "Cloud Platform",
    "OS",
    "Tool",
    "Other Technical",
    "Soft Skill",
    "Other", // Keep "Other" last
];

interface EditSkillsFormProps {
    currentUser: User | null;
    // Explicitly type the initial skills array
    initialSkills: SkillItem[] | null | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

const EditSkillsForm: React.FC<EditSkillsFormProps> = ({
    currentUser,
    initialSkills,
    onSuccess,
    onCancel
}) => {
    // State for the list of skills being edited
    const [skills, setSkills] = useState<SkillItem[]>(() =>
        // Ensure initial state is always an array and items have necessary structure
        (initialSkills || []).map(skill => ({
            id: skill.id || uuidv4(), // Ensure ID exists, generate if missing
            name: skill.name || '', // Default name to empty string
            category: skill.category || 'Other' // Default category if missing
        })).filter(skill => skill.name.trim() !== '') // Filter out any initially empty skills
    );

    // State for the new skill input fields
    const [newSkillName, setNewSkillName] = useState('');
    const [newSkillCategory, setNewSkillCategory] = useState(SKILL_CATEGORIES[0] || 'Other'); // Default to first category, fallback to 'Other'

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null); // General error for submission
    const [addError, setAddError] = useState<string | null>(null); // Error specific to adding a skill


    // Add a new skill to the list
    const addSkill = () => {
        const trimmedName = newSkillName.trim();
        if (!trimmedName) {
            setAddError("Skill name cannot be empty.");
            return;
        }
        // Check for duplicates (case-insensitive comparison, ignore category for uniqueness check)
        if (skills.some(skill => skill.name.toLowerCase() === trimmedName.toLowerCase())) {
             setAddError(`Skill "${trimmedName}" already exists.`);
             return;
        }

        const newItem: SkillItem = {
             id: uuidv4(), // Generate a new ID for each new skill
             name: trimmedName,
             category: newSkillCategory // Use the selected category
        };

        // Add the new item to the skills list
        setSkills(prev => [...prev, newItem]);

        // Reset input fields and clear errors
        setNewSkillName('');
        // Optionally reset category or keep the last selected one based on UX preference
        // setNewSkillCategory(SKILL_CATEGORIES[0]);
        setAddError(null);
        setError(null); // Clear general error on successful add
    };

     // Allow adding skill by pressing Enter in the name input
     const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
         // Add skill on Enter key press only (not shift+Enter, etc.) if input is not empty
         if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && newSkillName.trim()) {
             event.preventDefault(); // Prevent default form submission
             addSkill(); // Call the add function
         }
     };


    // Remove a skill from the list by its ID
    const removeSkill = (idToRemove: string) => {
        // Filter out the skill with the matching ID
        setSkills(prev => prev.filter(skill => skill.id !== idToRemove));
         // Optional: Clear general error if removing helps resolve it
         // setError(null);
    };

    // Handle final form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); // Prevent default browser form submission

        if (!currentUser) {
            setError("Authentication error: User not found.");
            return;
        }

        setIsSubmitting(true);
        setError(null); // Clear general form error on submit attempt
        setAddError(null); // Clear add error too


        // Prepare data: Filter out entries that are completely empty just in case
        const skillsToSave = skills.filter(skill => skill.name?.trim()).map(skill => ({
             // Keep ID if backend uses it for updates, otherwise backend might treat as new
             // Assuming backend uses ID for PATCH/PUT
             id: skill.id,
             name: skill.name.trim(), // Ensure name is trimmed
             category: skill.category || 'Other' // Ensure category is sent, default if somehow missing
        }));

        // Optional: Add validation if minimum number of skills is required
        // if (skillsToSave.length === 0 && initialSkills?.length > 0) {
        //     // Could potentially block submission or warn the user
        // }


        try {
            const token = await getIdToken(currentUser);
            // Assuming API endpoint expects the full list of skills to replace the existing ones
            const response = await fetch('/api/profile', { // Or a more specific /api/profile/skills if available
                method: 'PATCH', // Use PATCH if only updating the 'skills' field
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ skills: skillsToSave }), // Send the updated array under the 'skills' key
            });

            if (!response.ok) {
                // Attempt to parse error message from response, provide fallback
                const errorData = await response.json().catch(()=>{ return { message: 'Failed to save skills. Unknown error.' }});
                throw new Error(errorData.message || `Server responded with status ${response.status}`);
            }

            console.log("Skills updated successfully via API.");
            onSuccess(); // Call the success callback provided by the parent (closes modal, triggers refetch)

        } catch (err) {
            console.error("Error updating skills:", err);
            setError((err as Error).message); // Set the general form error
            setIsSubmitting(false); // Keep modal open on error
        }
    };

    // Group skills by category using useMemo for performance
    const groupedSkills = useMemo(() => {
        const groups = skills.reduce((acc, skill) => {
            const category = skill.category || 'Other'; // Default to 'Other' if missing
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(skill);
            return acc;
        }, {} as Record<string, SkillItem[]>); // Specify return type

        // Sort categories based on the SKILL_CATEGORIES array order, then alphabetically for others
        const sortedCategories = SKILL_CATEGORIES.filter(cat => groups[cat]);
        const otherCategories = Object.keys(groups).filter(cat => !SKILL_CATEGORIES.includes(cat)).sort();

        return [...sortedCategories, ...otherCategories].reduce((acc, category) => {
            acc[category] = groups[category].sort((a, b) => a.name.localeCompare(b.name)); // Sort skills within category alphabetically
            return acc;
        }, {} as Record<string, SkillItem[]>);

    }, [skills]); // Recalculate whenever 'skills' state changes


    // Styles (Keeping them for clarity)
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";
     // Style for the skill tags display
    const skillTagStyle = "flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200 flex-shrink-0"; // Neutral style, prevent shrinking
     // Style for the remove button inside a tag
     const removeTagButtonStyle = "p-0.5 rounded-full text-gray-500 hover:bg-gray-300 hover:text-gray-700 transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400";


    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] flex flex-col">
            {/* Header - Ensure sticky header doesn't hide content */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10 flex-shrink-0">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Skills</h3>
                 {/* Optional: Close button in header */}
                 {/* <button type="button" onClick={onCancel} disabled={isSubmitting} className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors" aria-label="Close modal"><X size={20}/></button> */}
            </div>

            {/* Add Skill Input Area */}
            <div className="border-b border-gray-200 pb-6 space-y-3 flex-shrink-0"> {/* Fixed height/space, doesn't scroll */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                     <div className="sm:col-span-2">
                         <label htmlFor="newSkillName" className={labelStyle}>Skill Name*</label>
                         <input
                            type="text"
                            id="newSkillName"
                            value={newSkillName}
                            onChange={(e) => { setNewSkillName(e.target.value); setAddError(null); }} // Clear error on input
                            onKeyDown={handleInputKeyDown} // Add skill on Enter
                            placeholder="e.g., React, Python, Teamwork"
                            className={inputBaseStyle}
                            disabled={isSubmitting} // Disable inputs while submitting
                            aria-invalid={!!addError}
                            aria-describedby={addError ? 'add-skill-error' : undefined}
                        />
                     </div>
                    <div>
                        <label htmlFor="newSkillCategory" className={labelStyle}>Category*</label>
                         <select
                            id="newSkillCategory"
                            value={newSkillCategory}
                            onChange={(e) => setNewSkillCategory(e.target.value)}
                             // Use inputBaseStyle and modify for select
                            className={`${inputBaseStyle} appearance-none bg-no-repeat bg-right w-full pl-3 pr-8 py-1.5 h-9`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundSize: `1.5em 1.5em`}}
                            disabled={isSubmitting}
                         >
                             {SKILL_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                             ))}
                             {/* Add an option for categories not in the predefined list if they exist in skills */}
                              {Object.keys(groupedSkills).filter(cat => !SKILL_CATEGORIES.includes(cat)).map(cat => (
                                 <option key={cat} value={cat}>{cat}</option>
                              ))}
                         </select>
                    </div>
                </div>
                 <button
                     type="button"
                     onClick={addSkill}
                     disabled={!newSkillName.trim() || isSubmitting} // Disable if input is empty OR submitting
                     className="flex items-center justify-center gap-2 w-full px-4 py-1.5 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3]"
                     aria-label="Add Skill"
                 >
                     <PlusCircle size={16}/> Add Skill
                 </button>
                 {addError && <p id="add-skill-error" className="text-xs text-red-600 mt-1 text-center">{addError}</p>}
            </div>

            {/* Display Current Skills (Scrollable) */}
            <div className='space-y-4 flex-grow overflow-y-auto py-4 -mx-1 px-1'> {/* Allow growth and scroll, add vertical padding, negative margin for full width scrollbar */}
                 {skills.length === 0 && (<p className="text-center text-gray-500 italic py-4">No skills added yet.</p>)}
                 {/* Grouped Display */}
                 {Object.entries(groupedSkills).map(([category, skillsInCategory]) => (
                     <div key={category}> {/* Key is the category name */}
                         <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'>{category}</p>
                         <div className="flex flex-wrap gap-2">
                             {skillsInCategory.map(skill => (
                                 <span key={skill.id} className={skillTagStyle}>
                                     {skill.name}
                                     <button
                                         type="button"
                                         onClick={() => removeSkill(skill.id)}
                                         className={removeTagButtonStyle}
                                         aria-label={`Remove skill ${skill.name}`}
                                         disabled={isSubmitting} // Disable remove while submitting
                                     >
                                         <X size={12} aria-hidden="true"/> {/* 'X' icon, hide from screen readers */}
                                     </button>
                                 </span>
                             ))}
                         </div>
                     </div>
                 ))}
            </div>

            {/* Submission Area (Sticky Footer) */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10 flex-shrink-0 items-center"> {/* Add items-center for vertical alignment */}
                {/* Show general error (likely submission related) */}
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>} {/* Use mr-auto to push buttons right */}
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-400"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting} // Disable submit button while submitting
                    className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors min-w-[8rem]" // Added min-width
                >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5 text-white" /> : 'Save Skills'}
                </button>
            </div>
        </form>
    );
};

export default EditSkillsForm;