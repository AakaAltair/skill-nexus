// components/EditCertificationsForm.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2, Link as LinkIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// Define the shape of a single certification item
// (Should match the type in your main profile interface)
interface CertificationItem {
    id: string;
    name: string; // Name of the certification/license
    issuer: string; // Issuing Organization
    issueDate?: string; // Store as 'YYYY-MM-DD'
    expirationDate?: string; // Store as 'YYYY-MM-DD' or 'No Expiration'
    credentialUrl?: string | null; // Optional link to verify
}

// Define the props for the form component
interface EditCertificationsFormProps {
    currentUser: User | null;
    initialCertifications: Array<{ // Type matching profileData.certifications
        id: string;
        name: string;
        issuer: string;
        issueDate?: any;
        expirationDate?: any; // Can be string 'No Expiration'
        credentialUrl?: string | null;
    }> | null | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

// Helper function to format dates for <input type="date">
// (Move to lib/dateUtils.ts later)
function formatInputDate(date: any): string {
     if (!date || typeof date !== 'object' || date === null || date === 'No Expiration') {
         // Handle common non-date string values or return formatted if possible
         if(typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
         if(typeof date === 'string' && !isNaN(Date.parse(date))) {
             try { return format(new Date(date), 'yyyy-MM-dd'); } catch { /* ignore */ }
         }
         return ''; // Return empty if not date-like or if it's "No Expiration" etc.
     }
     try {
         let d: Date;
         if (date instanceof Timestamp) { d = date.toDate(); }
         else if (date instanceof Date) { d = date; }
         else { return ''; }
         if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
     } catch (e) { console.warn("Input Date formatting error:", date, e); }
     return '';
}

const EditCertificationsForm: React.FC<EditCertificationsFormProps> = ({
    currentUser,
    initialCertifications,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data
    const [certifications, setCertifications] = useState<CertificationItem[]>(() =>
        (initialCertifications || []).map(cert => ({
            id: cert.id || uuidv4(),
            name: cert.name || '',
            issuer: cert.issuer || '',
            issueDate: formatInputDate(cert.issueDate),
            // Keep 'No Expiration' as string, format other dates
            expirationDate: cert.expirationDate === 'No Expiration' ? 'No Expiration' : formatInputDate(cert.expirationDate),
            credentialUrl: cert.credentialUrl || '',
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific item
    const handleItemChange = (index: number, field: keyof CertificationItem, value: string | boolean) => { // Allow boolean for checkbox
        const updatedCerts = [...certifications];
        const currentItem = updatedCerts[index];

        // Handle the 'No Expiration' checkbox specifically
        if (field === 'expirationDate' && typeof value === 'boolean') {
             currentItem.expirationDate = value ? 'No Expiration' : ''; // Set to 'No Expiration' or clear date
        } else if (typeof value === 'string') { // Handle regular string inputs
             (currentItem as any)[field] = value;
             // If user types in expiration date field, uncheck 'No Expiration'
             if (field === 'expirationDate' && value !== '') {
                 currentItem.expirationDate = value; // Keep the typed date
             } else if (field === 'expirationDate' && value === '' && currentItem.expirationDate === 'No Expiration') {
                 // If they clear the date field WHILE 'No Expiration' is checked, keep it checked (do nothing to string value)
             } else if (field === 'expirationDate' && value === '') {
                 // If they clear the date field and it wasn't 'No Expiration', just clear it
                 currentItem.expirationDate = '';
             }

        } else {
             console.warn("Unexpected value type in handleItemChange:", field, value);
        }
        setCertifications(updatedCerts);
    };

    // Add a new blank item
    const addCertificationItem = () => {
        const newItem: CertificationItem = {
            id: uuidv4(), name: '', issuer: '', issueDate: '', expirationDate: '', credentialUrl: ''
        };
        setCertifications(prev => [...prev, newItem]);
        setTimeout(() => { window.document.getElementById(`cert-item-${newItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    };

    // Remove an item
    const removeCertificationItem = (indexToRemove: number) => {
        const item = certifications[indexToRemove];
        if (item && (item.name || item.issuer)) {
            if (!confirm("Remove this certification entry?")) return;
        }
        setCertifications(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }
        setIsSubmitting(true); setError(null);

        // Prepare data for backend
        const certificationsToSave = certifications
            .filter(cert => cert.name?.trim() && cert.issuer?.trim()) // Require name and issuer
            .map(cert => ({
                ...cert,
                issueDate: cert.issueDate || null,
                expirationDate: cert.expirationDate || null, // Send 'No Expiration' string or date string or null
                credentialUrl: cert.credentialUrl?.trim() || null,
            }));

        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ certifications: certificationsToSave }),
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
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Licenses & Certifications</h3>
            </div>

            {/* List of Editable Items */}
            <div className='space-y-6'>
                {certifications.length === 0 && (<p className="text-center text-gray-500 italic py-4">No certifications added yet.</p>)}
                {certifications.map((cert, index) => (
                    <div key={cert.id} id={`cert-item-${cert.id}`} className="p-4 border border-gray-200 rounded-lg space-y-3 relative bg-gray-50/50">
                        <button type="button" onClick={() => removeCertificationItem(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors z-10" aria-label="Remove entry"> <Trash2 size={16} /> </button>
                        {/* Fields */}
                        <div> <label htmlFor={`cert-name-${cert.id}`} className={labelStyle}>Name*</label> <input type="text" id={`cert-name-${cert.id}`} required value={cert.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} className={inputBaseStyle} /> </div>
                        <div> <label htmlFor={`cert-issuer-${cert.id}`} className={labelStyle}>Issuing Organization*</label> <input type="text" id={`cert-issuer-${cert.id}`} required value={cert.issuer} onChange={(e) => handleItemChange(index, 'issuer', e.target.value)} className={inputBaseStyle} /> </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div> <label htmlFor={`cert-issueDate-${cert.id}`} className={labelStyle}>Issue Date</label> <input type="date" id={`cert-issueDate-${cert.id}`} value={cert.issueDate || ''} onChange={(e) => handleItemChange(index, 'issueDate', e.target.value)} className={inputBaseStyle} /> </div>
                            <div>
                                <label htmlFor={`cert-expirationDate-${cert.id}`} className={labelStyle}>Expiration Date</label>
                                <input
                                    type="date"
                                    id={`cert-expirationDate-${cert.id}`}
                                    value={cert.expirationDate === 'No Expiration' ? '' : cert.expirationDate || ''}
                                    onChange={(e) => handleItemChange(index, 'expirationDate', e.target.value)}
                                    className={`${inputBaseStyle}`}
                                    disabled={cert.expirationDate === 'No Expiration'}
                                />
                                 <label className='flex items-center mt-1.5 cursor-pointer'>
                                    <input
                                        type='checkbox'
                                        checked={cert.expirationDate === 'No Expiration'}
                                        onChange={(e) => handleItemChange(index, 'expirationDate', e.target.checked)} // Pass boolean
                                        className='h-4 w-4 rounded border-gray-300 text-[#0070F3] focus:ring-[#0070F3]'/>
                                    <span className='ml-2 text-sm text-gray-700'>No Expiration</span>
                                 </label>
                            </div>
                        </div>
                        <div> <label htmlFor={`cert-url-${cert.id}`} className={labelStyle}>Credential URL</label> <input type="url" id={`cert-url-${cert.id}`} value={cert.credentialUrl || ''} onChange={(e) => handleItemChange(index, 'credentialUrl', e.target.value)} className={inputBaseStyle} placeholder="https://link-to-your-credential" /> </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button type="button" onClick={addCertificationItem} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3] transition-colors">
                <PlusCircle size={16}/> Add Certification/License
            </button>

            {/* Submission Area */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"> Cancel </button>
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-36"> {/* Adjusted width */}
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Certifications'}
                </button>
            </div>
        </form>
    );
};

export default EditCertificationsForm;