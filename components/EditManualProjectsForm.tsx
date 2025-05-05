// components/EditManualProjectsForm.tsx
"use client";

import React, { useState, FormEvent, KeyboardEvent } from 'react'; // Added KeyboardEvent
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2, Link as LinkIcon, X } from 'lucide-react'; // Added X icon
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// Define the shape of a single manual project item
interface ManualProjectItem {
    id: string;
    title: string;
    description: string;
    projectUrl?: string | null;
    skills?: string[]; // Store skills as an array of strings
    startDate?: string; // Store as 'YYYY-MM-DD'
    endDate?: string; // Store as 'YYYY-MM-DD'
    // associatedWith?: string; // Optional field - skip for simple V1 form
}

// Props for the form component
interface EditManualProjectsFormProps {
    currentUser: User | null;
    initialProjects: Array<{ // Match profile data structure
        id: string;
        title: string;
        description: string;
        projectUrl?: string | null;
        skills?: string[];
        startDate?: any;
        endDate?: any;
    }> | null | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

// Helper function to format dates for <input type="date">
// (Move to lib/dateUtils.ts later)
function formatInputDate(date: any): string {
     if (!date) return '';
     try {
         let d: Date;
         if (date instanceof Timestamp) { d = date.toDate(); }
         else if (date instanceof Date) { d = date; }
         else { d = new Date(date); }
         if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
     } catch (e) { console.warn("Input Date formatting error:", date, e); }
     return '';
}

const EditManualProjectsForm: React.FC<EditManualProjectsFormProps> = ({
    currentUser,
    initialProjects,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data
    const [projects, setProjects] = useState<ManualProjectItem[]>(() =>
        (initialProjects || []).map(proj => ({
            id: proj.id || uuidv4(),
            title: proj.title || '',
            description: proj.description || '',
            projectUrl: proj.projectUrl || '',
            // Ensure skills is an array, handle potential strings if needed from old data
            skills: Array.isArray(proj.skills) ? proj.skills : (typeof proj.skills === 'string' && proj.skills ? [proj.skills] : []), // Basic handling for string -> array
            startDate: formatInputDate(proj.startDate),
            endDate: formatInputDate(proj.endDate),
        }))
    );
    // Temporary state for skill input within each project item (map projectId to input value)
    const [currentSkillInput, setCurrentSkillInput] = useState<{ [projectId: string]: string }>({});


    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific project item's input fields
    const handleItemChange = (index: number, field: keyof ManualProjectItem, value: string) => {
        const updatedProjects = [...projects];
        // Use type assertion carefully
        (updatedProjects[index] as any)[field] = value;
        setProjects(updatedProjects);
    };

     // Handle skill input changes for a specific project
     const handleSkillInputChange = (projectId: string, value: string) => {
        setCurrentSkillInput(prev => ({ ...prev, [projectId]: value }));
     };

    // Add a skill tag to a specific project
     const addSkillTag = (index: number) => {
         const project = projects[index];
         const projectId = project.id;
         const skillName = (currentSkillInput[projectId] || '').trim();

         if (skillName && !project.skills?.includes(skillName)) { // Check if skill name is valid and not a duplicate
             const updatedProjects = [...projects];
             // Ensure skills array exists before adding
             updatedProjects[index].skills = [...(updatedProjects[index].skills || []), skillName];
             setProjects(updatedProjects);
             // Clear the input for that project after adding
             setCurrentSkillInput(prev => ({ ...prev, [projectId]: '' }));
         } else if (skillName) {
             console.warn(`Skill "${skillName}" already exists or is empty for project ${projectId}.`); // Warn about duplicates
         }
     };

     // Handle Enter or Comma key press in skill input
     const handleSkillInputKeyPress = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
         if (event.key === 'Enter' || event.key === ',') {
             event.preventDefault(); // Prevent form submission or comma appearing
             addSkillTag(index);
         }
     };


     // Remove a skill tag from a specific project
     const removeSkillTag = (projectIndex: number, skillToRemove: string) => {
        const updatedProjects = [...projects];
         updatedProjects[projectIndex].skills = updatedProjects[projectIndex].skills?.filter(skill => skill !== skillToRemove);
        setProjects(updatedProjects);
     };

    // Add a new blank project item
    const addProjectItem = () => {
        const newItem: ManualProjectItem = {
            id: uuidv4(), title: '', description: '', projectUrl: '', skills: [], startDate: '', endDate: ''
        };
        setProjects(prev => [...prev, newItem]);
        // Scroll to new item
        setTimeout(() => {
             // Use the new item's ID to target the DOM element
             const newItemElement = window.document.getElementById(`project-item-${newItem.id}`);
             newItemElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             // Optional: focus the first input of the new item
             (newItemElement?.querySelector('input[type="text"]') as HTMLElement)?.focus();
        }, 100);
    };

    // Remove a project item
    const removeProjectItem = (indexToRemove: number) => {
        const item = projects[indexToRemove];
        // Ask confirmation only if item has some content
        if (item && (item.title || item.description || item.projectUrl || (item.skills && item.skills.length > 0))) {
            if (!confirm("Remove this project entry?")) return;
        }
        setProjects(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }
        setIsSubmitting(true); setError(null);

        // Prepare data for backend
        const projectsToSave = projects
            // Filter out entries that are completely empty or only have whitespace in title/description
            .filter(proj => proj.title?.trim() || proj.description?.trim() || proj.projectUrl?.trim() || (proj.skills && proj.skills.length > 0))
            .map(proj => ({
                id: proj.id, // Keep ID
                title: proj.title.trim(),
                description: proj.description.trim(),
                projectUrl: proj.projectUrl?.trim() || null,
                skills: proj.skills && proj.skills.length > 0 ? proj.skills.map(s => s.trim()).filter(s => s) : [], // Trim skills, ensure array
                startDate: proj.startDate || null,
                endDate: proj.endDate || null,
            }));

         // Basic validation before saving
         const hasEmptyRequiredFields = projectsToSave.some(proj => !proj.title || !proj.description);
         if (hasEmptyRequiredFields && projectsToSave.length > 0) { // Only check if there are items to save
             setError("Project Title and Description are required for all entries.");
             setIsSubmitting(false);
             return;
         }


        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ manualProjects: projectsToSave }), // Send updated array
            });
            if (!response.ok) {
                const d = await response.json().catch(()=>{ return { message: 'Failed to save projects. Unknown error.' }});
                throw new Error(d.message || 'Failed to update projects');
            }
            console.log("Manual Projects updated successfully");
            onSuccess(); // Close modal and refetch
        } catch (err) {
            console.error("Error updating manual projects:", err);
            setError((err as Error).message);
            setIsSubmitting(false);
        }
    };

    // Styles
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";
     const skillTagStyle = "flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded border border-gray-200"; // Neutral style
     const removeTagButtonStyle = "p-0.5 rounded-full hover:bg-gray-300 text-gray-500 hover:text-gray-700"; // Neutral style


    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Other Projects</h3>
            </div>

            {/* List of Editable Project Items */}
            <div className='space-y-6'>
                {projects.length === 0 && (<p className="text-center text-gray-500 italic py-4">No other projects added yet.</p>)}
                {projects.map((proj, index) => (
                    <div key={proj.id} id={`project-item-${proj.id}`} className="p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
                        <button type="button" onClick={() => removeProjectItem(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors z-10" aria-label="Remove project entry"> <Trash2 size={16} /> </button>
                        {/* Fields */}
                        <div> <label htmlFor={`proj-title-${proj.id}`} className={labelStyle}>Project Title*</label> <input type="text" id={`proj-title-${proj.id}`} required value={proj.title} onChange={(e) => handleItemChange(index, 'title', e.target.value)} className={inputBaseStyle} /> </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div> <label htmlFor={`proj-startDate-${proj.id}`} className={labelStyle}>Start Date</label> <input type="date" id={`proj-startDate-${proj.id}`} value={proj.startDate || ''} onChange={(e) => handleItemChange(index, 'startDate', e.target.value)} className={inputBaseStyle} /> </div>
                            <div> <label htmlFor={`proj-endDate-${proj.id}`} className={labelStyle}>End Date</label> <input type="date" id={`proj-endDate-${proj.id}`} value={proj.endDate || ''} onChange={(e) => handleItemChange(index, 'endDate', e.target.value)} className={inputBaseStyle} /> </div>
                         </div>
                         <div> <label htmlFor={`proj-url-${proj.id}`} className={labelStyle}>Project URL</label> <input type="url" id={`proj-url-${proj.id}`} value={proj.projectUrl || ''} onChange={(e) => handleItemChange(index, 'projectUrl', e.target.value)} className={inputBaseStyle} placeholder="https://github.com/user/repo or demo.com" /> </div>

                         {/* Skills Input & Display */}
                         <div>
                             <label htmlFor={`proj-skills-input-${proj.id}`} className={labelStyle}>Skills Used (Type skill and press Enter or Comma)</label>
                             <input
                                 type="text"
                                 id={`proj-skills-input-${proj.id}`}
                                 value={currentSkillInput[proj.id] || ''}
                                 onChange={(e) => handleSkillInputChange(proj.id, e.target.value)}
                                 onKeyDown={(e) => handleSkillInputKeyPress(e, index)} // Use combined handler
                                 className={inputBaseStyle}
                                 placeholder="e.g., React, Node.js, Firebase"
                             />
                             {/* Display current skill tags */}
                             {proj.skills && proj.skills.length > 0 && (
                                 <div className="flex flex-wrap gap-2 mt-2">
                                     {proj.skills.map((skill, skillIndex) => (
                                         <span key={`${proj.id}-${skillIndex}`} className={skillTagStyle}>
                                             {skill}
                                             <button
                                                 type="button"
                                                 onClick={() => removeSkillTag(index, skill)}
                                                 className={removeTagButtonStyle}
                                                 aria-label={`Remove skill ${skill}`}
                                             >
                                                 <X size={12} />
                                             </button>
                                         </span>
                                     ))}
                                 </div>
                             )}
                         </div>

                        <div>
                            <label htmlFor={`proj-description-${proj.id}`} className={labelStyle}>Description*</label>
                            <textarea id={`proj-description-${proj.id}`} rows={4} required value={proj.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className={inputBaseStyle + ' min-h-[80px]'} placeholder="Describe the project, your role, and key features or outcomes... (Markdown supported)"></textarea>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button type="button" onClick={addProjectItem} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3] transition-colors">
                <PlusCircle size={16}/> Add Another Project
            </button>

            {/* Submission Area */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-400"> Cancel </button> {/* Added focus style */}
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-32">
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Projects'}
                </button>
            </div>
        </form>
    );
};

export default EditManualProjectsForm;