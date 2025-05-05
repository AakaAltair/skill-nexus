// components/ResourceBanner.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Resource } from '@/lib/types/resource'; // *** Use Resource type ***
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Reusable theme utility

interface ResourceBannerProps {
    resource: Resource | null; // *** Changed prop name and type ***
    isOwner: boolean;
    onDeleteRequest: () => void; // Callback to trigger delete modal in parent
}

// --- Helper Functions ---
function formatDate(dateString: string | undefined | Date, options?: Intl.DateTimeFormatOptions): string {
    if (!dateString) return 'N/A';
    // Default formatting options
    const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    try {
        // Handle if Date object is passed directly, otherwise parse string
        const date = dateString instanceof Date ? dateString : new Date(dateString.toString());
        // Check if date is valid after parsing
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    } catch {
        return 'Invalid Date';
    }
}

// Define Theme Structures - Copied/Adapted from ClassroomBanner
// You can customize these themes specifically for resources if desired
interface BannerTheme {
    id: number;
    name: string;
    backgroundClasses: string;
    primaryTextClass: string;
    secondaryTextClass: string;
    accentColorClass: string; // Might be less used directly here, but kept for structure
    buttonBaseClass: string;
    buttonHoverClass: string;
    // Specific style functions for badges/tags
    typeBadgeStyle: (type: string | undefined) => string;
    categoryTagStyle: (index: number) => string;
    linkButtonStyle: string; // Added specific style for the external link button
}

// --- Define Multiple Themes --- (Using the project themes for consistency)
const themes: BannerTheme[] = [
    // Theme 1: Ocean Wave
    { id: 1, name: "Ocean Wave", backgroundClasses: "bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600", primaryTextClass: "text-white", secondaryTextClass: "text-indigo-100", accentColorClass: "text-blue-300", buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25", typeBadgeStyle: (type) => `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-white/10 text-indigo-100`, categoryTagStyle: (index) => `border border-white/30 text-white/90 bg-white/5 hover:bg-white/15 text-xs px-3 py-1 rounded-full`, linkButtonStyle: 'border-white/40 bg-white/20 text-white hover:bg-white/30' },
    // Theme 2: Sunset Fade
    { id: 2, name: "Sunset Fade", backgroundClasses: "bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400", primaryTextClass: "text-white", secondaryTextClass: "text-red-100", accentColorClass: "text-yellow-200", buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25", typeBadgeStyle: (type) => `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-white/10 text-red-100`, categoryTagStyle: (index) => `border border-white/30 text-white/90 bg-white/5 hover:bg-white/15 text-xs px-3 py-1 rounded-full`, linkButtonStyle: 'border-white/40 bg-white/20 text-white hover:bg-white/30' },
    // Theme 3: Minimal Geo
    { id: 3, name: "Minimal Geo", backgroundClasses: "bg-white border border-gray-200", primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600", accentColorClass: "text-blue-600", buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600", typeBadgeStyle: (type) => `text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-blue-100 text-blue-800 border-blue-300`, categoryTagStyle: (index) => { const a = ['border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100', 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100', 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100', 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100']; return `border text-xs px-3 py-1 rounded-full transition-colors ${a[index % a.length]}`; }, linkButtonStyle: 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600' },
    // Theme 4: Forest Mist
    { id: 4, name: "Forest Mist", backgroundClasses: "bg-gradient-to-tl from-emerald-500 via-teal-500 to-cyan-600", primaryTextClass: "text-white", secondaryTextClass: "text-teal-100", accentColorClass: "text-emerald-300", buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25", typeBadgeStyle: (type) => `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-white/10 text-teal-100`, categoryTagStyle: (index) => `border border-white/30 text-white/90 bg-white/5 hover:bg-white/15 text-xs px-3 py-1 rounded-full`, linkButtonStyle: 'border-white/40 bg-white/20 text-white hover:bg-white/30' },
    // Theme 5: Default Gray
    { id: 5, name: "Default Gray", backgroundClasses: "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 border border-gray-200", primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600", accentColorClass: "text-blue-600", buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600", typeBadgeStyle: (type) => `text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-gray-200 text-gray-700 border-gray-300`, categoryTagStyle: (index) => `border border-gray-300 bg-white text-xs px-3 py-1 rounded-full transition-colors hover:bg-gray-50`, linkButtonStyle: 'border-gray-600 bg-gray-600 text-white hover:bg-gray-700' },
];

// --- Resource Banner Component ---
const ResourceBanner: React.FC<ResourceBannerProps> = ({ resource, isOwner, onDeleteRequest }) => {

    // Select background theme using the reusable utility based on resource ID
    const backgroundTheme = useMemo(() => {
        return getProjectThemeStyles(resource?.id); // Use resource ID or fallback
    }, [resource?.id]);

    // Find the full theme details matching the selected background
    const fullTheme = useMemo(() => {
        return themes.find(t => t.backgroundClasses === backgroundTheme.backgroundClasses) || themes[themes.length - 1]; // Use default gray as fallback
    }, [backgroundTheme]);

    // Render placeholder if resource data is not yet available
    if (!resource) {
         // Simple placeholder with matching minimum height
         return <div className="w-full rounded-xl shadow-lg mb-8 md:mb-10 bg-gray-100 animate-pulse min-h-[280px]"></div>; // Increased min-height slightly
    }

    // --- Owner Button Styling ---
    // Base styles + hover styles defined in theme
    const editButtonClass = `${fullTheme.buttonBaseClass} ${fullTheme.buttonHoverClass}`;
    // Specific delete button hover state depending on theme lightness
    const deleteButtonBase = (fullTheme.id === 3 || fullTheme.id === 5) // Light themes
        ? "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-red-500 hover:bg-red-50 hover:text-red-700"
        : fullTheme.buttonBaseClass + " hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-50"; // Dark themes
    const deleteButtonClass = `${deleteButtonBase}`;

    // --- Prepare Category Tags for Display ---
    // Combine branch, year, subject, college, and actual tags into one list
    const categoryTags = [
        resource.branch, resource.year, resource.subject, resource.college, ...(resource.tags || [])
    ].filter(Boolean) as string[]; // Filter out any null/undefined/empty values

    return (
        <div
            // Apply selected theme background, padding, shadow etc.
            className={`w-full rounded-xl shadow-lg mb-8 md:mb-10 relative overflow-hidden p-8 md:p-10 lg:p-12 ${fullTheme.backgroundClasses} min-h-[280px] flex flex-col justify-between`} // Increased min-height
        >
            {/* Top Section: Title, Meta, Owner Buttons */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-start gap-4">
                {/* Left: Title & Essential Meta */}
                <div className="flex-1 min-w-0">
                    {/* Resource Title */}
                    <h1 className={`text-3xl md:text-4xl font-bold mb-3 break-words leading-tight ${fullTheme.primaryTextClass}`}>
                        {resource.title}
                    </h1>
                    {/* Meta Info Row */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm mb-4 ${fullTheme.secondaryTextClass}`}>
                         {/* Resource Type Badge */}
                         {resource.resourceType && (
                            <span className={fullTheme.typeBadgeStyle(resource.resourceType)}>
                                {resource.resourceType}
                            </span>
                         )}
                         {/* Uploader Info */}
                        <div className="flex items-center shrink-0" title={`Shared by: ${resource.uploaderName || 'Unknown'}`}>
                            <img src={resource.uploaderPhotoURL || '/default-avatar.png'} alt="" className="w-5 h-5 rounded-full mr-1.5 border border-current opacity-60"/> {/* Adjusted opacity */}
                            <span className="opacity-90">{resource.uploaderName || 'Unknown'}</span>
                        </div>
                         {/* Creation Date */}
                        <div className="flex items-center shrink-0" title={`Shared: ${formatDate(resource.createdAt)}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 mr-1 opacity-70"><path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 .75.75V3h6.5V2.5a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15.75 5.75v7.5A2.75 2.75 0 0 1 13 16H3A2.75 2.75 0 0 1 .25 13.25v-7.5A2.75 2.75 0 0 1 3 3h.25V2.5A.75.75 0 0 1 4 1.75ZM3.5 6a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Z" clipRule="evenodd" /></svg>
                              <span className="opacity-90">{formatDate(resource.createdAt, {month: 'short', day: 'numeric'})}</span> {/* Simpler format */}
                        </div>
                         {/* External Link Button */}
                         {resource.linkURL && (
                             <a
                                href={resource.linkURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-colors duration-150 ${fullTheme.linkButtonStyle}`} // Use theme-specific link style
                                title="Access original resource link"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.381 3.995c.03-.12.07-.238.114-.354l4-4a.75.75 0 0 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06-.002.738.738 0 0 1-.113-.353Zm-.243 1.55a.738.738 0 0 0-.113.353.75.75 0 0 0 1.06 1.06l4-4a.75.75 0 0 0-1.06-1.06l-4 4c-.03.03-.06.06-.084.09Z"/><path fillRule="evenodd" d="M5.005 6.381a.75.75 0 0 0-1.06 0l-4 4a.75.75 0 0 0 1.06 1.06l4-4a.75.75 0 0 0 0-1.06ZM9.995 1.03a.75.75 0 0 0 0 1.06l4 4a.75.75 0 0 0 1.06-1.06l-4-4a.75.75 0 0 0-1.06 0ZM1.03 9.995a.75.75 0 0 0-1.06 1.06l4 4a.75.75 0 1 0 1.06-1.06l-4-4a.75.75 0 0 0 0-1.06ZM6.03 14.96a.75.75 0 0 0 1.06 0l4-4a.75.75 0 1 0-1.06-1.06l-4 4a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" /></svg>
                                Access Link
                            </a>
                         )}
                    </div>
                </div>

                 {/* Right: Owner Buttons */}
                 {isOwner && (
                    <div className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 md:mt-0 flex-shrink-0"> {/* Added mt-4 for mobile */}
                        {/* Link to the Resource Edit Page */}
                        <Link
                             href={`/resources/${resource.id}/edit`} // Correct link for resource edit
                             className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${editButtonClass}`}
                             title="Edit resource details"
                        >
                            {/* Edit Icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.812 1.568L5.75 11.25a.75.75 0 0 0 .988.728l2.908-.83a2.75 2.75 0 0 0 1.568-.813l4.263-4.262a1.75 1.75 0 0 0 0-2.475l-1.562-1.563ZM12.22 3.78a.25.25 0 0 1 .353 0l1.563 1.562a.25.25 0 0 1 0 .353L8.873 11.01a1.25 1.25 0 0 1-.713.368l-2.24.64a.25.25 0 0 1-.316-.316l.64-2.24a1.25 1.25 0 0 1 .368-.713L12.22 3.78Z"/><path d="M2.5 5.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z"/></svg>
                            Edit
                        </Link>
                        <button
                            onClick={onDeleteRequest} // Trigger delete confirmation
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${deleteButtonClass}`}
                            title="Delete resource"
                         >
                             {/* Delete Icon */}
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.5-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" /></svg>
                             Delete
                         </button>
                    </div>
                 )}
            </div>

            {/* Bottom Section: Description & Category Tags */}
            <div className="relative z-10 mt-auto pt-6">
                {/* Description */}
                {resource.description && (
                    <p className={`text-base mb-5 leading-relaxed ${fullTheme.secondaryTextClass} ${fullTheme.id !== 3 && fullTheme.id !== 5 ? 'opacity-90' : '' }`}> {/* Use secondary text class, adjust opacity */}
                        {resource.description}
                    </p>
                 )}
                 {/* Category Tags */}
                 {categoryTags.length > 0 && (
                     <div className="mt-4">
                         <h3 className={`text-xs font-semibold mb-2 uppercase tracking-wider ${fullTheme.secondaryTextClass} opacity-80`}>Details</h3>
                         <div className="flex flex-wrap gap-2">
                            {/* Display combined category tags */}
                            {categoryTags.slice(0, 8).map((tag, index) => ( // Limit displayed tags
                                <span
                                    key={`${tag}-${index}`}
                                    // Use theme-specific category tag styling
                                    className={`${fullTheme.categoryTagStyle(index)}`}
                                >
                                    {tag}
                                </span>
                             ))}
                             {/* Indicator for more tags */}
                             {categoryTags.length > 8 && (
                                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${fullTheme.id === 3 || fullTheme.id === 5 ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-black/10 text-current opacity-70 border-current/30'}`}>
                                    + {categoryTags.length - 8} more
                                </span>
                            )}
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default ResourceBanner;