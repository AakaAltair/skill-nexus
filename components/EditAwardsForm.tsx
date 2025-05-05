// components/EditAwardsForm.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// Define the shape of a single award item
interface AwardItem {
    id: string;
    title: string; // Name of the award/honor
    issuer?: string | null; // Organization/Institution giving the award
    date?: string; // Store as 'YYYY-MM-DD'
    description?: string | null; // Optional details
}

// Define the props for the form component
interface EditAwardsFormProps {
    currentUser: User | null;
    initialAwards: Array<{ // Type matching profileData.awards
        id: string;
        title: string;
        issuer?: string | null;
        date?: any;
        description?: string | null;
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
     } catch (e) {}
     return '';
}

const EditAwardsForm: React.FC<EditAwardsFormProps> = ({
    currentUser,
    initialAwards,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data
    const [awards, setAwards] = useState<AwardItem[]>(() =>
        (initialAwards || []).map(award => ({
            id: award.id || uuidv4(),
            title: award.title || '',
            issuer: award.issuer || '',
            date: formatInputDate(award.date),
            description: award.description || '',
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific item
    const handleItemChange = (index: number, field: keyof AwardItem, value: string) => {
        const updatedAwards = [...awards];
        (updatedAwards[index] as any)[field] = value;
        setAwards(updatedAwards);
    };

    // Add a new blank item
    const addAwardItem = () => {
        const newItem: AwardItem = { id: uuidv4(), title: '', issuer: '', date: '', description: '' };
        setAwards(prev => [...prev, newItem]);
        setTimeout(() => { window.document.getElementById(`award-item-${newItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    };

    // Remove an item
    const removeAwardItem = (indexToRemove: number) => {
        const item = awards[indexToRemove];
        if (item && item.title) { // Ask confirm only if title exists
            if (!confirm(`Remove award "${item.title}"?`)) return;
        }
        setAwards(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }
        setIsSubmitting(true); setError(null);

        // Prepare data: Filter out entries without a title
        const awardsToSave = awards
            .filter(award => award.title?.trim())
            .map(award => ({
                ...award,
                issuer: award.issuer?.trim() || null,
                date: award.date || null,
                description: award.description?.trim() || null,
            }));

        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ awards: awardsToSave }), // Send updated array
            });
            if (!response.ok) { const d = await response.json().catch(()=>{}); throw new Error(d.message || 'Failed'); }
            onSuccess();
        } catch (err) { setError((err as Error).message); setIsSubmitting(false); }
    };

    // Styles
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Honors & Awards</h3>
            </div>

            {/* List of Editable Award Items */}
            <div className='space-y-6'>
                {awards.length === 0 && (<p className="text-center text-gray-500 italic py-4">No honors or awards added yet.</p>)}
                {awards.map((award, index) => (
                    <div key={award.id} id={`award-item-${award.id}`} className="p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
                        <button type="button" onClick={() => removeAwardItem(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors z-10" aria-label="Remove award entry"> <Trash2 size={16} /> </button>
                        {/* Fields */}
                        <div> <label htmlFor={`award-title-${award.id}`} className={labelStyle}>Title*</label> <input type="text" id={`award-title-${award.id}`} required value={award.title} onChange={(e) => handleItemChange(index, 'title', e.target.value)} className={inputBaseStyle} placeholder="e.g., Dean's List, Hackathon Winner" /> </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div> <label htmlFor={`award-issuer-${award.id}`} className={labelStyle}>Issuer (Optional)</label> <input type="text" id={`award-issuer-${award.id}`} value={award.issuer || ''} onChange={(e) => handleItemChange(index, 'issuer', e.target.value)} className={inputBaseStyle} placeholder="e.g., XYZ University, Tech Conference" /> </div>
                            <div> <label htmlFor={`award-date-${award.id}`} className={labelStyle}>Date Received (Optional)</label> <input type="date" id={`award-date-${award.id}`} value={award.date || ''} onChange={(e) => handleItemChange(index, 'date', e.target.value)} className={inputBaseStyle} /> </div>
                        </div>
                        <div>
                            <label htmlFor={`award-description-${award.id}`} className={labelStyle}>Description (Optional)</label>
                            <textarea id={`award-description-${award.id}`} rows={2} value={award.description || ''} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className={inputBaseStyle + ' min-h-[50px]'} placeholder="Briefly describe the honor or award..."></textarea>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button type="button" onClick={addAwardItem} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3] transition-colors">
                <PlusCircle size={16}/> Add Honor or Award
            </button>

            {/* Submission Area */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"> Cancel </button>
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-32">
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Awards'}
                </button>
            </div>
        </form>
    );
};

export default EditAwardsForm;