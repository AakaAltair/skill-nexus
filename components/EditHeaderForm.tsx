// components/EditHeaderForm.tsx
"use client";

import React, { useState, FormEvent, useEffect } from 'react';
import { User, getIdToken } from 'firebase/auth'; // Import User for type
import { Loader2, Linkedin, Github, Globe, Mail, Phone } from 'lucide-react';
// We don't strictly need next/image for the preview if using <img>,
// but keeping it if other parts of your app rely on its typical import style.

// --- Helper function to get initials ---
const getInitials = (name?: string | null, email?: string | null): string => {
    if (name) {
        const parts = name.trim().split(/\s+/).filter(Boolean); // Split by spaces and remove empty strings
        if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0]) {
            return parts[0].substring(0, 2).toUpperCase(); // First two letters if single name
        }
    }
    if (email) {
        return email[0].toUpperCase();
    }
    return 'P'; // Default placeholder (e.g., "Profile") if no name or email
};

interface EditHeaderFormProps {
    currentUser: User; // currentUser is guaranteed by DashboardPage logic
    initialProfileData: { // Subset of StudentProfile relevant to header
        name: string;
        photoURL?: string | null;
        headline?: string | null;
        contactInfo?: {
            email?: string | null;
            phone?: string | null;
            location?: string | null;
            portfolioUrl?: string | null;
            linkedInUrl?: string | null;
            githubUrl?: string | null;
        } | null;
    };
    onSuccess: () => void;
    onCancel: () => void;
}

const EditHeaderForm: React.FC<EditHeaderFormProps> = ({
    currentUser,
    initialProfileData,
    onSuccess,
    onCancel
}) => {
    // Initialize state from props, prioritizing profileData, then currentUser, then empty
    const [name, setName] = useState(initialProfileData?.name || currentUser?.displayName || '');
    const [headline, setHeadline] = useState(initialProfileData?.headline || '');
    const [photoURL, setPhotoURL] = useState(initialProfileData?.photoURL || currentUser?.photoURL || '');
    const [phone, setPhone] = useState(initialProfileData?.contactInfo?.phone || '');
    const [portfolioUrl, setPortfolioUrl] = useState(initialProfileData?.contactInfo?.portfolioUrl || '');
    const [linkedInUrl, setLinkedInUrl] = useState(initialProfileData?.contactInfo?.linkedInUrl || '');
    const [githubUrl, setGithubUrl] = useState(initialProfileData?.contactInfo?.githubUrl || '');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [photoPreviewError, setPhotoPreviewError] = useState(false); // To track if <img> onError fires

    // Reset preview error when photoURL (input) changes
    useEffect(() => {
        setPhotoPreviewError(false);
    }, [photoURL]);

    // Simple URL validation (basic syntax check for http/https)
    const isValidUrl = (url: string | null | undefined): boolean => {
        if (!url || url.trim() === '') return true; // Allow empty string, null, undefined as valid (for optional fields)
        try {
            const parsedUrl = new URL(url);
            return ['http:', 'https:'].includes(parsedUrl.protocol);
        } catch (_) {
            return false;
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null); // Clear previous errors

        // Validation
        if (!name.trim()) {
            setError("Full Name cannot be empty.");
            return;
        }
        // Only validate URLs if they are not empty
        if (photoURL.trim() && !isValidUrl(photoURL)) {
            setError("Invalid Photo URL. It must be a full URL starting with http:// or https://.");
            return;
        }
        if (portfolioUrl.trim() && !isValidUrl(portfolioUrl)) {
            setError("Invalid Portfolio URL provided."); return;
        }
        if (linkedInUrl.trim() && !isValidUrl(linkedInUrl)) {
             setError("Invalid LinkedIn URL provided."); return;
        }
        if (githubUrl.trim() && !isValidUrl(githubUrl)) {
             setError("Invalid GitHub URL provided."); return;
        }

        setIsSubmitting(true);

        const profileUpdates = {
            name: name.trim(),
            headline: headline.trim() || null,
            photoURL: photoURL.trim() || null,
            contactInfo: {
                // Preserve other contact info fields that might exist but aren't edited here
                ...(initialProfileData?.contactInfo || {}),
                // Ensure email from auth is always present if it exists
                email: currentUser.email || initialProfileData?.contactInfo?.email || null,
                phone: phone.trim() || null,
                portfolioUrl: portfolioUrl.trim() || null,
                linkedInUrl: linkedInUrl.trim() || null,
                githubUrl: githubUrl.trim() || null,
            }
        };

        // Clean up contactInfo: if all specific editable fields are null, set contactInfo to null
        // This prevents sending an empty object { email: '...' } if phone, portfolio, etc. are cleared.
        const contactFieldsToCheck = ['phone', 'portfolioUrl', 'linkedInUrl', 'githubUrl'];
        const hasEditableContactInfo = contactFieldsToCheck.some(field => !!profileUpdates.contactInfo[field as keyof typeof profileUpdates.contactInfo]);

        if (!hasEditableContactInfo && !profileUpdates.contactInfo.email && !profileUpdates.contactInfo.location /* check other non-editable fields if any */) {
            profileUpdates.contactInfo = null;
        } else if (!hasEditableContactInfo && profileUpdates.contactInfo.email) {
             // Keep contactInfo if only email (or other non-editable preserved fields) exists
             profileUpdates.contactInfo = { email: profileUpdates.contactInfo.email } as any; // Adjust if more preserved fields
        }


        try {
            const token = await getIdToken(currentUser);
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(profileUpdates),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP Error: ${response.status} ${response.statusText}` }));
                throw new Error(errorData.message || 'Failed to update profile header');
            }
            console.log("Profile header updated successfully");
            onSuccess(); // Close modal and trigger refetch in parent component

        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Styles (already defined in your code, assuming they are correct)
    const inputBaseStyle = "w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 text-sm focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black placeholder-gray-400";
    const labelStyle = "block text-sm font-medium text-black mb-1";

    // Logic for avatar preview
    const currentPhotoURLTrimmed = photoURL.trim();
    const showImagePreview = currentPhotoURLTrimmed && isValidUrl(currentPhotoURLTrimmed) && !photoPreviewError;

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-white rounded-b-lg max-h-[80vh] overflow-y-auto relative">
            {/* Sticky Header */}
            <div className="sticky top-0 bg-white pt-0 pb-4 border-b border-gray-200 -mx-6 px-6 z-10 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-black" id="modal-title">Edit Introduction</h3>
            </div>

            {/* Scrollable Content Area */}
            <div className="space-y-4 pb-20"> {/* Add padding-bottom to avoid overlap with sticky footer */}
                <div>
                    <label htmlFor="profile-name" className={labelStyle}>Full Name*</label>
                    <input type="text" id="profile-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputBaseStyle} />
                </div>

                <div>
                    <label htmlFor="profile-headline" className={labelStyle}>Headline</label>
                    <input type="text" id="profile-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputBaseStyle} placeholder="e.g., Student at XYZ University | Aspiring Developer" maxLength={150} />
                </div>

                 {/* --- Profile Picture URL Field with Preview and Fallback --- */}
                 <div>
                    <label htmlFor="profile-photoURL" className={labelStyle}>Profile Picture URL</label>
                    <input
                        type="url" // Allows browser URL validation hints
                        id="profile-photoURL"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)} // photoPreviewError is reset by useEffect
                        className={inputBaseStyle}
                        placeholder="https://example.com/your-photo.jpg"
                    />
                     {/* Avatar Preview and Helper Text */}
                     <div className="flex items-center gap-4 mt-2">
                         {/* Conditional rendering for <img> or Fallback */}
                         {showImagePreview ? (
                              <img
                                 src={currentPhotoURLTrimmed} // Use the trimmed and validated URL
                                 alt="Avatar preview"
                                //  width={40} // Not strictly needed for <img> if using className for size
                                //  height={40}
                                 className='w-10 h-10 rounded-full object-cover border flex-shrink-0'
                                 onError={() => {
                                     console.warn("Preview image failed to load from URL:", currentPhotoURLTrimmed);
                                     setPhotoPreviewError(true); // Trigger fallback on error
                                 }}
                              />
                         ) : (
                             // Fallback: Initials avatar
                             <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-sm font-medium border flex-shrink-0">
                                 {/* Use getInitials helper with current form name and currentUser email */}
                                 {getInitials(name || currentUser.displayName, currentUser.email)}
                             </div>
                         )}
                        <p className="text-xs text-gray-500 flex-grow">Enter a direct URL (http/https). Actual upload TBD.</p>
                     </div>
                     {/* Display validation/load errors below input */}
                    {photoURL.trim() && !isValidUrl(photoURL) && <p className="mt-1 text-xs text-red-600">Invalid URL format. Must be a full URL (e.g., https://...)</p>}
                     {photoPreviewError && photoURL.trim() && isValidUrl(photoURL) && <p className="mt-1 text-xs text-red-600">Could not load image from this URL. Please check the link.</p>}
                 </div>


                 <h4 className="text-md font-semibold text-black pt-2 border-t border-gray-100">Contact Info</h4>

                 <div>
                     <label htmlFor="profile-phone" className={labelStyle}>Phone (Optional)</label>
                     <input type="tel" id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputBaseStyle} placeholder="+1 (555) 123-4567" />
                 </div>
                  <div>
                     <label htmlFor="profile-portfolio" className={labelStyle}>Portfolio URL (Optional)</label>
                     <div className="relative">
                         <Globe size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                         <input type="url" id="profile-portfolio" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} className={`${inputBaseStyle} pl-9`} placeholder="https://your-portfolio.com" />
                     </div>
                 </div>
                 <div>
                     <label htmlFor="profile-linkedin" className={labelStyle}>LinkedIn URL (Optional)</label>
                      <div className="relative">
                         <Linkedin size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input type="url" id="profile-linkedin" value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} className={`${inputBaseStyle} pl-9`} placeholder="https://linkedin.com/in/your-profile" />
                      </div>
                 </div>
                 <div>
                     <label htmlFor="profile-github" className={labelStyle}>GitHub URL (Optional)</label>
                     <div className="relative">
                         <Github size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input type="url" id="profile-github" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className={`${inputBaseStyle} pl-9`} placeholder="https://github.com/your-username" />
                      </div>
                 </div>
            </div>


            {/* Sticky Submission Area */}
            <div className="sticky bottom-0 bg-white py-4 border-t border-gray-200 -mx-6 px-6 z-10 flex justify-end gap-3">
                {error && <p className="text-sm text-red-600 mr-auto self-center px-1 max-w-xs truncate" title={error}>{error}</p>}
                <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"> Cancel </button>
                <button
                    type="submit"
                    disabled={isSubmitting || (photoURL.trim() && !isValidUrl(photoURL))} // Disable if submitting or photoURL is entered but invalid
                    className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-32"
                >
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save Header'}
                </button>
            </div>
        </form>
    );
};

export default EditHeaderForm;