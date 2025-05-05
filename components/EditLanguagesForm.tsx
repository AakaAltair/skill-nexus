// components/EditLanguagesForm.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Define the shape of a single language item
interface LanguageItem {
    id: string;
    language: string;
    proficiency: string; // e.g., Native, Fluent, Conversational, Basic
}

// Define standard proficiency levels (customize as needed)
const PROFICIENCY_LEVELS = [
    "Native or Bilingual",
    "Full Professional", // Fluent
    "Professional Working", // Conversational+
    "Limited Working",
    "Elementary", // Basic
];

// Define the props for the form component
interface EditLanguagesFormProps {
    currentUser: User | null;
    initialLanguages: Array<{ // Type matching profileData.languages
        id: string;
        language: string;
        proficiency: string;
    }> | null | undefined;
    onSuccess: () => void;
    onCancel: () => void;
}

const EditLanguagesForm: React.FC<EditLanguagesFormProps> = ({
    currentUser,
    initialLanguages,
    onSuccess,
    onCancel
}) => {
    // State: Initialize with existing data
    const [languages, setLanguages] = useState<LanguageItem[]>(() =>
        (initialLanguages || []).map(lang => ({
            id: lang.id || uuidv4(),
            language: lang.language || '',
            proficiency: lang.proficiency || PROFICIENCY_LEVELS[1], // Default proficiency
        }))
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle changes within a specific item
    const handleItemChange = (index: number, field: keyof LanguageItem, value: string) => {
        const updatedLanguages = [...languages];
        (updatedLanguages[index] as any)[field] = value;
        setLanguages(updatedLanguages);
    };

    // Add a new blank item
    const addLanguageItem = () => {
        const newItem: LanguageItem = {
            id: uuidv4(), language: '', proficiency: PROFICIENCY_LEVELS[1] // Default proficiency
        };
        setLanguages(prev => [...prev, newItem]);
         // Scroll to new item
        setTimeout(() => { window.document.getElementById(`lang-item-${newItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
    };

    // Remove an item
    const removeLanguageItem = (indexToRemove: number) => {
        const item = languages[indexToRemove];
        if (item && item.language) { // Ask confirm only if language is filled
            if (!confirm(`Remove language "${item.language}"?`)) return;
        }
        setLanguages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentUser) { setError("Authentication error."); return; }
        setIsSubmitting(true); setError(null);

        // Prepare data: Filter out entries with no language name
        const languagesToSave = languages
            .filter(lang => lang.language?.trim())
            .map(lang => ({ // Send only necessary fields if backend doesn't need ID
                id: lang.id, // Keep ID if needed by backend for updates/diffing
                language: lang.language.trim(),
                proficiency: lang.proficiency,
            }));

        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ languages: languagesToSave }), // Send updated array
            });
            if (!response.ok) { const d = await response.json().catch(()=>{}); throw new Error(d.message || 'Failed'); }
            onSuccess();
        } catch (err) { setError((err as Error).message); setIsSubmitting(false); }
    };

    // Styles
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400";
    const labelStyle = "block text-xs font-medium text-gray-700 mb-1";
    const selectBaseStyle = inputBaseStyle.replace('px-3', 'pl-3 pr-8') + ' appearance-none bg-no-repeat bg-right';
    const selectArrowStyle = { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundSize: `1.5em 1.5em`};

    return (
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10">
                 <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Languages</h3>
            </div>

            {/* List of Editable Language Items */}
            <div className='space-y-4'>
                {languages.length === 0 && (<p className="text-center text-gray-500 italic py-4">No languages added yet.</p>)}
                {languages.map((lang, index) => (
                    <div key={lang.id} id={`lang-item-${lang.id}`} className="flex items-end gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50/50 relative">
                        <div className="flex-1">
                            <label htmlFor={`lang-name-${lang.id}`} className={labelStyle}>Language*</label>
                            <input type="text" id={`lang-name-${lang.id}`} required value={lang.language} onChange={(e) => handleItemChange(index, 'language', e.target.value)} className={inputBaseStyle} placeholder="e.g., English, Spanish" />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`lang-proficiency-${lang.id}`} className={labelStyle}>Proficiency*</label>
                            <select id={`lang-proficiency-${lang.id}`} required value={lang.proficiency} onChange={(e) => handleItemChange(index, 'proficiency', e.target.value)} className={selectBaseStyle} style={selectArrowStyle}>
                                {PROFICIENCY_LEVELS.map(level => (
                                    <option key={level} value={level}>{level}</option>
                                ))}
                            </select>
                        </div>
                        <button type="button" onClick={() => removeLanguageItem(index)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 mb-1" aria-label="Remove language"> <Trash2 size={16} /> </button>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <button type="button" onClick={addLanguageItem} className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-black focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#0070F3] transition-colors">
                <PlusCircle size={16}/> Add Language
            </button>

            {/* Submission Area */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-4 -mx-6 px-6 z-10">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1">{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"> Cancel </button>
                <button type="submit" disabled={isSubmitting} className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-32">
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Languages'}
                </button>
            </div>
        </form>
    );
};

export default EditLanguagesForm;