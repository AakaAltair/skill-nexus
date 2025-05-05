// components/EditEducationForm.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import { format } from 'date-fns'; // For formatting dates
import { Timestamp } from 'firebase/firestore'; // For type checking

// Define the shape of a single education item
// (Should match the type in your main profile interface)
interface EducationItem {
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate?: string; // Store as 'YYYY-MM-DD'
    endDate?: string; // Store as 'YYYY-MM-DD' or 'Expected'/'Present' ? (Decide how to handle ongoing)
    description?: string | null;
}

// Define the props for the form component
interface EditEducationFormProps {
    currentUser: User | null;
    initialEducation: Array<{ // Type matching profileData.education
        id: string;
        institution: string;
        degree: string;
        fieldOfStudy: string;
        startDate?: any;
        endDate?: any;
        description?: string | null;
    }> | null | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

// --- Helper function to format dates for <input type="date"> ---
// (Move this to lib/dateUtils.ts later if not already done)
function formatInputDate(date: any): string {
     // Allow specific strings like 'Present' or 'Expected' to pass through?
     // For now, only format date-like things
     if (!date || typeof date !== 'object' || date === null) {
         if(typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date; // Already formatted?
         if(typeof date === 'string' && !isNaN(Date.parse(date))) { // Try parsing other strings
              try { return format(new Date(date), 'yyyy-MM-dd'); } catch { return ''; }
         }
         return '';
     }
     try {
         let d: Date;
         if (date instanceof Timestamp) { d = date.toDate(); }
         else if (date instanceof Date) { d = date; }
         else { return ''; } // Unknown object type

         if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');

     } catch (e) { console.warn("Input Date formatting error:", date, e); }
     return '';
}


const EditEducationForm: React.FC<EditEducationFormProps> = ({
    currentUser,
    initialEducation,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data, formatting dates
    const [educations, setEducations] = useState<EducationItem[]>(() =>
        (initialEducation || []).map(edu => ({
            id: edu.id || uuidv4(),
            institution: edu.institution || '',
            degree: edu.degree || '',
            fieldOfStudy: edu.fieldOfStudy || '',
            startDate: formatInputDate(edu.startDate),
            // How to handle expected grad? Maybe just use the date field or a separate checkbox?
            // Let's assume endDate can store 'YYYY-MM-DD' or potentially a string like 'Expected Dec 2025'
            // The input field will only accept YYYY-MM-DD, so we might need different handling or just use description.
            // For simplicity, we format potential dates, otherwise keep original string or empty.
            endDate: formatInputDate(edu.endDate) || (typeof edu.endDate === 'string' ? edu.endDate : ''), // Keep string if not date-like
            description: edu.description || '',
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific education item's input fields
    const handleItemChange = (index: number, field: keyof EducationItem, value: string) => {
        const updatedEducations = [...educations];
        (updatedEducations[index] as any)[field] = value;
        setEducations(updatedEducations);
    };

    // Add a new blank education item
    const addEducationItem = () => {
        const newItem: EducationItem = {
            id: uuidv4(), institution: '', degree: '', fieldOfStudy: '',
            startDate: '', endDate: '', description: ''
        };
        setEducations(prev => [...prev, newItem]);
        // Scroll to new item
        setTimeout(() => { window.document.getElementById(`education-item-${newItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    };

    // Remove an education item
    const removeEducationItem = (indexToRemove: number) => {
        const item = educations[indexToRemove];
        if (item && (item.institution || item.degree || item.fieldOfStudy)) {
            if (!confirm("Remove this education entry?")) return;
        }
        setEducations(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }
        setIsSubmitting(true); setError(null);

        // Prepare data for backend (ensure empty dates are null)
        const educationsToSave = educations
            .filter(edu => edu.institution?.trim() || edu.degree?.trim() || edu.fieldOfStudy?.trim()) // Filter empty
            .map(edu => ({
                ...edu,
                startDate: edu.startDate || null,
                endDate: edu.endDate || null, // Send date string, expected grad string, or null
                description: edu.description?.trim() || null,
            }));

        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ education: educationsToSave }), // Send updated array
            });
            if (!response.ok) { const d = await response.json().catch(()=>{}); throw new Error(d.message || 'Failed'); }
            onSuccess(); // Close modal and refetch
        } catch (err) { setError((err as Error).message); setIsSubmitting(false); }
    };

    // Styles
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Education</h3>
            </div>

            {/* List of Editable Education Items */}
            <div className='space-y-6'>
                {educations.length === 0 && (<p className="text-center text-gray-500 italic py-4">No education added yet.</p>)}
                {educations.map((edu, index) => (
                    <div key={edu.id} id={`education-item-${edu.id}`} className="p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
                        <button type="button" onClick={() => removeEducationItem(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors z-10" aria-label="Remove education entry"> <Trash2 size={16} /> </button>
                        {/* Fields */}
                        <div> <label htmlFor={`institution-${edu.id}`} className={labelStyle}>Institution*</label> <input type="text" id={`institution-${edu.id}`} required value={edu.institution} onChange={(e) => handleItemChange(index, 'institution', e.target.value)} className={inputBaseStyle} /> </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div> <label htmlFor={`degree-${edu.id}`} className={labelStyle}>Degree*</label> <input type="text" id={`degree-${edu.id}`} required value={edu.degree} onChange={(e) => handleItemChange(index, 'degree', e.target.value)} className={inputBaseStyle} placeholder="e.g., Bachelor of Technology" /> </div>
                            <div> <label htmlFor={`fieldOfStudy-${edu.id}`} className={labelStyle}>Field of Study*</label> <input type="text" id={`fieldOfStudy-${edu.id}`} required value={edu.fieldOfStudy} onChange={(e) => handleItemChange(index, 'fieldOfStudy', e.target.value)} className={inputBaseStyle} placeholder="e.g., Computer Science" /> </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div> <label htmlFor={`startDate-${edu.id}`} className={labelStyle}>Start Date</label> <input type="date" id={`startDate-${edu.id}`} value={edu.startDate || ''} onChange={(e) => handleItemChange(index, 'startDate', e.target.value)} className={inputBaseStyle} /> </div>
                            <div> <label htmlFor={`endDate-${edu.id}`} className={labelStyle}>End Date</label> <input type="date" id={`endDate-${edu.id}`} value={edu.endDate || ''} onChange={(e) => handleItemChange(index, 'endDate', e.target.value)} className={inputBaseStyle} /> <span className="text-xs text-gray-500 italic"> Leave blank if ongoing/expected</span> </div>
                            {/* Alternative: Checkbox for 'Expected Graduation' if date is in future? */}
                        </div>
                        <div>
                            <label htmlFor={`description-${edu.id}`} className={labelStyle}>Description (Optional)</label>
                            <textarea id={`description-${edu.id}`} rows={3} value={edu.description || ''} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className={inputBaseStyle + ' min-h-[60px]'} placeholder="e.g., Relevant coursework, Minor, Honors..."></textarea>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button type="button" onClick={addEducationItem} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3]">
                <PlusCircle size={16}/> Add Education
            </button>

            {/* Submission Area */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"> Cancel </button>
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-32">
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Education'}
                </button>
            </div>
        </form>
    );
};

export default EditEducationForm;