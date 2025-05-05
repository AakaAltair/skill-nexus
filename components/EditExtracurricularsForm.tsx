// components/EditExtracurricularsForm.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// Define the shape of a single activity item
interface ActivityItem {
    id: string;
    organization: string; // Club/Organization Name
    position: string; // Role/Position held
    description?: string | null; // Optional description of activities/impact
    startDate?: string; // Store as 'YYYY-MM-DD'
    endDate?: string; // Store as 'YYYY-MM-DD' or 'Present'
}

// Define the props for the form component
interface EditExtracurricularsFormProps {
    currentUser: User | null;
    initialActivities: Array<{ // Type matching profileData.extracurriculars
        id: string;
        organization: string;
        position: string;
        description?: string | null;
        startDate?: any;
        endDate?: any;
    }> | null | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

// Helper function to format dates for <input type="date">
// (Move to lib/dateUtils.ts later)
function formatInputDate(date: any): string {
     if (!date || date === 'Present') return '';
     try {
         let d: Date;
         if (date instanceof Timestamp) { d = date.toDate(); }
         else if (date instanceof Date) { d = date; }
         else { d = new Date(date); }
         if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
     } catch (e) {}
     return '';
}

const EditExtracurricularsForm: React.FC<EditExtracurricularsFormProps> = ({
    currentUser,
    initialActivities,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data
    const [activities, setActivities] = useState<ActivityItem[]>(() =>
        (initialActivities || []).map(act => ({
            id: act.id || uuidv4(),
            organization: act.organization || '',
            position: act.position || '',
            description: act.description || '',
            startDate: formatInputDate(act.startDate),
            endDate: act.endDate === 'Present' ? 'Present' : formatInputDate(act.endDate),
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific item
    const handleItemChange = (index: number, field: keyof ActivityItem, value: string | boolean) => {
        const updatedActivities = [...activities];
        const currentItem = updatedActivities[index];
         if (field === 'endDate' && typeof value === 'boolean') {
             currentItem.endDate = value ? 'Present' : ''; // Handle checkbox
         } else if (typeof value === 'string'){
             (currentItem as any)[field] = value;
              // If user types in expiration date field, uncheck 'Present'
             if (field === 'endDate' && value !== '' && currentItem.endDate === 'Present') {
                 currentItem.endDate = value;
             } else if (field === 'endDate' && value === '' && currentItem.endDate !== 'Present') {
                 // Allow clearing the date if not 'Present'
                 currentItem.endDate = '';
             }
         }
        setActivities(updatedActivities);
    };

    // Add a new blank item
    const addActivityItem = () => {
        const newItem: ActivityItem = { id: uuidv4(), organization: '', position: '', description: '', startDate: '', endDate: '' };
        setActivities(prev => [...prev, newItem]);
        setTimeout(() => { window.document.getElementById(`activity-item-${newItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    };

    // Remove an item
    const removeActivityItem = (indexToRemove: number) => {
        const item = activities[indexToRemove];
        if (item && (item.organization || item.position)) {
            if (!confirm(`Remove activity "${item.organization || item.position}"?`)) return;
        }
        setActivities(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }
        setIsSubmitting(true); setError(null);

        // Prepare data: Filter out entries missing key info, handle dates/nulls
        const activitiesToSave = activities
            .filter(act => act.organization?.trim() && act.position?.trim()) // Require organization and position
            .map(act => ({
                ...act,
                startDate: act.startDate || null,
                endDate: act.endDate === 'Present' ? 'Present' : (act.endDate || null),
                description: act.description?.trim() || null,
            }));

        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ extracurriculars: activitiesToSave }), // Send updated array
            });
            if (!response.ok) { const d = await response.json().catch(()=>{}); throw new Error(d.message || 'Failed'); }
            onSuccess();
        } catch (err) { setError((err as Error).message); setIsSubmitting(false); }
    };

    // Styles
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400 disabled:bg-gray-100";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Extracurricular Activities</h3>
            </div>

            {/* List of Editable Activity Items */}
            <div className='space-y-6'>
                {activities.length === 0 && (<p className="text-center text-gray-500 italic py-4">No activities added yet.</p>)}
                {activities.map((act, index) => (
                    <div key={act.id} id={`activity-item-${act.id}`} className="p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
                        <button type="button" onClick={() => removeActivityItem(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors z-10" aria-label="Remove activity entry"> <Trash2 size={16} /> </button>
                        {/* Fields */}
                        <div> <label htmlFor={`act-org-${act.id}`} className={labelStyle}>Organization/Club*</label> <input type="text" id={`act-org-${act.id}`} required value={act.organization} onChange={(e) => handleItemChange(index, 'organization', e.target.value)} className={inputBaseStyle} /> </div>
                        <div> <label htmlFor={`act-pos-${act.id}`} className={labelStyle}>Your Role/Position*</label> <input type="text" id={`act-pos-${act.id}`} required value={act.position} onChange={(e) => handleItemChange(index, 'position', e.target.value)} className={inputBaseStyle} /> </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div> <label htmlFor={`act-startDate-${act.id}`} className={labelStyle}>Start Date</label> <input type="date" id={`act-startDate-${act.id}`} value={act.startDate || ''} onChange={(e) => handleItemChange(index, 'startDate', e.target.value)} className={inputBaseStyle} /> </div>
                            <div>
                                <label htmlFor={`act-endDate-${act.id}`} className={labelStyle}>End Date</label>
                                <input type="date" id={`act-endDate-${act.id}`} value={act.endDate === 'Present' ? '' : act.endDate || ''} onChange={(e) => handleItemChange(index, 'endDate', e.target.value)} className={`${inputBaseStyle}`} disabled={act.endDate === 'Present'} />
                                 <label className='flex items-center mt-1.5 cursor-pointer'> <input type='checkbox' checked={act.endDate === 'Present'} onChange={(e) => handleItemChange(index, 'endDate', e.target.checked)} className='h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3]'/> <span className='ml-2 text-sm text-gray-700'>Still Participating</span> </label>
                            </div>
                        </div>
                        <div>
                            <label htmlFor={`act-description-${act.id}`} className={labelStyle}>Description (Optional)</label>
                            <textarea id={`act-description-${act.id}`} rows={3} value={act.description || ''} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className={inputBaseStyle + ' min-h-[60px]'} placeholder="Describe your activities and impact..."></textarea>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button type="button" onClick={addActivityItem} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3] transition-colors">
                <PlusCircle size={16}/> Add Activity
            </button>

            {/* Submission Area */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"> Cancel </button>
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-36"> {/* Adjusted width */}
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Activities'}
                </button>
            </div>
        </form>
    );
};

export default EditExtracurricularsForm;