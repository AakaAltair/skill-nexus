// components/PlacementDriveBanner.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link'; // For the Edit button link
import { PlacementDrive, PlacementStatus } from '@/lib/types/placement'; // Ensure path is correct
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Ensure path is correct
// Import required icons from lucide-react
import { MessageSquare, MapPin, CalendarDays, Edit, Trash2, ExternalLink } from 'lucide-react';

// --- Component Props Interface ---
interface PlacementDriveBannerProps {
    drive: PlacementDrive | null; // The placement drive data object
    isOwner: boolean; // Flag indicating if the current user posted this drive
    onDeleteRequest: () => void; // Function to call when delete button is clicked (opens modal in parent)
    onToggleChat: () => void; // Function to call when Q&A button is clicked (toggles sidebar in parent)
    // Optional: Pass chat state if button appearance needs to change
    // isChatOpen?: boolean;
}

// --- Helper Functions ---
// Formats date string or Date object into a readable format
function formatDate(dateInput: string | Date | undefined | null, options?: Intl.DateTimeFormatOptions): string {
    if (!dateInput) return 'N/A'; // Handle null/undefined input
    // Default date format options
    const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    try {
        // Create Date object from input
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput.toString());
        // Check for invalid date
        if (isNaN(date.getTime())) { return 'Invalid Date'; }
        // Return formatted date string
        return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    } catch (e) {
        console.error("Error formatting date in Banner:", e);
        return 'Invalid Date';
    }
}

// Define Theme Structures for styling banner elements
// (Can be customized further for placement drives specifically if desired)
interface BannerTheme {
    id: number;
    name: string;
    backgroundClasses: string; // Main background style
    primaryTextClass: string; // Style for primary text (e.g., title)
    secondaryTextClass: string; // Style for secondary text (e.g., meta info)
    accentColorClass: string; // General accent color (might not be used directly)
    buttonBaseClass: string; // Base style for action buttons
    buttonHoverClass: string; // Hover style for action buttons
    statusBadgeStyle: (status: string | undefined) => string; // Function to get status badge style
    linkButtonStyle: string; // Style for the external link button
}

// --- Define Multiple Themes --- (Using themes consistent with project/resource banners)
// These provide different visual appearances based on the drive ID hash
const themes: BannerTheme[] = [
    // Theme 1: Ocean Wave (Blue/Purple)
    { id: 1, name: "Ocean Wave", backgroundClasses: "bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600", primaryTextClass: "text-white", secondaryTextClass: "text-indigo-100", accentColorClass: "text-blue-300", buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25", statusBadgeStyle: (status) => { const base = 'border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border '; switch(status) { case 'Ongoing': return base + 'bg-blue-400/30 text-blue-100'; case 'Upcoming': return base + 'bg-yellow-400/30 text-yellow-100'; default: return base + 'bg-white/10 text-indigo-100'; } }, linkButtonStyle: 'border-white/40 bg-white/20 text-white hover:bg-white/30' },
    // Theme 2: Sunset Fade (Red/Orange)
    { id: 2, name: "Sunset Fade", backgroundClasses: "bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400", primaryTextClass: "text-white", secondaryTextClass: "text-red-100", accentColorClass: "text-yellow-200", buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25", statusBadgeStyle: (status) => { const base = 'border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border '; switch(status) { case 'Ongoing': return base + 'bg-blue-400/30 text-blue-100'; case 'Upcoming': return base + 'bg-yellow-400/30 text-yellow-100'; default: return base + 'bg-white/10 text-red-100'; } }, linkButtonStyle: 'border-white/40 bg-white/20 text-white hover:bg-white/30' },
    // Theme 3: Minimal Geo (Light)
    { id: 3, name: "Minimal Geo", backgroundClasses: "bg-white border border-gray-200", primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600", accentColorClass: "text-blue-600", buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600", statusBadgeStyle: (status) => { const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border "; switch (status) { case 'Ongoing': return base + 'bg-blue-100 text-blue-800 border-blue-300'; case 'Upcoming': return base + 'bg-yellow-100 text-yellow-800 border-yellow-300'; default: return base + 'bg-gray-100 text-gray-700 border-gray-300'; } }, linkButtonStyle: 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600' },
    // Theme 4: Forest Mist (Green/Teal)
    { id: 4, name: "Forest Mist", backgroundClasses: "bg-gradient-to-tl from-emerald-500 via-teal-500 to-cyan-600", primaryTextClass: "text-white", secondaryTextClass: "text-teal-100", accentColorClass: "text-emerald-300", buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25", statusBadgeStyle: (status) => { const base = 'border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border '; switch(status) { case 'Ongoing': return base + 'bg-blue-400/30 text-blue-100'; case 'Upcoming': return base + 'bg-yellow-400/30 text-yellow-100'; default: return base + 'bg-white/10 text-teal-100'; } }, linkButtonStyle: 'border-white/40 bg-white/20 text-white hover:bg-white/30' },
    // Theme 5: Default Gray (Fallback)
    { id: 5, name: "Default Gray", backgroundClasses: "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 border border-gray-200", primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600", accentColorClass: "text-blue-600", buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600", statusBadgeStyle: (status) => { const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border "; switch(status) { case 'Ongoing': return base + 'bg-blue-100 text-blue-800 border-blue-300'; case 'Upcoming': return base + 'bg-yellow-100 text-yellow-800 border-yellow-300'; default: return base + 'bg-gray-100 text-gray-700 border-gray-300'; } }, linkButtonStyle: 'border-gray-600 bg-gray-600 text-white hover:bg-gray-700' },
];

// --- Placement Drive Banner Component ---
const PlacementDriveBanner: React.FC<PlacementDriveBannerProps> = ({
    drive,
    isOwner,
    onDeleteRequest,
    onToggleChat // Receive chat toggle function
    // isChatOpen // Receive chat state if needed for button visual change
}) => {

    // Select background theme using the reusable utility based on drive ID
    const backgroundTheme = useMemo(() => {
        return getProjectThemeStyles(drive?.id); // Pass drive ID or fallback
    }, [drive?.id]);

    // Find the full theme details matching the selected background
    const fullTheme = useMemo(() => {
        // Find theme where backgroundClasses match, or use the last theme as default
        return themes.find(t => t.backgroundClasses === backgroundTheme.backgroundClasses) || themes[themes.length - 1];
    }, [backgroundTheme]);

    // --- Render placeholder if drive data is not yet available ---
    if (!drive) {
         // Simple placeholder with minimum height matching the banner
         return <div className="w-full rounded-xl shadow-lg mb-6 md:mb-8 bg-gray-100 animate-pulse min-h-[180px]"></div>;
    }

    // --- Button Styling ---
    // Base styles + hover styles defined in theme
    const editButtonClass = `${fullTheme.buttonBaseClass} ${fullTheme.buttonHoverClass}`;
    // Style for chat button (using same base style)
    const chatButtonClass = `${fullTheme.buttonBaseClass} ${fullTheme.buttonHoverClass}`;
    // Specific delete button hover state depending on theme lightness
    const deleteButtonBase = (fullTheme.id === 3 || fullTheme.id === 5) // Light themes use different hover
        ? "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-red-500 hover:bg-red-50 hover:text-red-700"
        : fullTheme.buttonBaseClass + " hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-50"; // Dark themes use different hover
    const deleteButtonClass = `${deleteButtonBase}`;

    // --- Determine Key Date to Display ---
    const displayDate = drive.keyDates?.applicationDeadline || drive.keyDates?.testDate || drive.createdAt;
    const displayDateLabel = drive.keyDates?.applicationDeadline ? 'Apply by' : (drive.keyDates?.testDate ? 'Test Date' : 'Posted');

    return (
        <div
            // Apply selected theme background, padding, shadow etc.
            className={`w-full rounded-xl shadow-lg mb-6 md:mb-8 relative overflow-hidden p-6 md:p-8 ${fullTheme.backgroundClasses} min-h-[180px] flex flex-col justify-between`}
        >
            {/* Top Section: Title, Company, Meta, Action Buttons */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-start gap-4">
                {/* Left: Role Title, Company Name & Meta Info */}
                <div className="flex-1 min-w-0">
                    {/* Role Title */}
                    <h1 className={`text-2xl md:text-3xl font-bold mb-1 break-words leading-tight ${fullTheme.primaryTextClass}`}>
                        {drive.roleTitle || 'Placement Drive'}
                    </h1>
                    {/* Company Name */}
                    <p className={`text-lg font-medium mb-3 ${fullTheme.secondaryTextClass} ${fullTheme.id !== 3 && fullTheme.id !== 5 ? 'opacity-90' : '' }`}>
                        at {drive.companyName || 'Unknown Company'}
                    </p>
                    {/* Meta Info Row (Status, Date, Location) */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm ${fullTheme.secondaryTextClass}`}>
                        {/* Status Badge */}
                        {drive.status && (
                           <span className={fullTheme.statusBadgeStyle(drive.status)}>
                               {drive.status}
                           </span>
                        )}
                        {/* Key Date */}
                        {displayDate && (
                            <div className="flex items-center shrink-0" title={`${displayDateLabel}: ${formatDate(displayDate)}`}>
                                <CalendarDays size={16} className="w-4 h-4 mr-1 opacity-70"/>
                                <span className="opacity-90">{displayDateLabel}: {formatDate(displayDate, {month: 'short', day: 'numeric'})}</span>
                            </div>
                        )}
                        {/* Location */}
                        {drive.location && (
                           <div className="flex items-center shrink-0" title={`Location: ${drive.location}`}>
                                <MapPin size={16} className="w-4 h-4 mr-1 opacity-70"/>
                                <span className="opacity-90">{drive.location}</span>
                          </div>
                        )}
                         {/* External Application Link Button */}
                         {drive.applicationLink && (
                             <a
                                href={drive.applicationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold transition-colors duration-150 ${fullTheme.linkButtonStyle}`} // Use theme-specific link style
                                title="Open Application Link"
                            >
                                <ExternalLink size={14} className="w-3.5 h-3.5"/>
                                Apply Link
                            </a>
                         )}
                    </div>
                </div>

                {/* Right: Action Buttons (Q&A, Edit, Delete) */}
                 <div className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 md:mt-0 flex-shrink-0">
                     {/* Q&A Toggle Button */}
                     {/* Show only if comments are enabled for this drive */}
                     {drive.commentsEnabled !== false && (
                         <button
                            onClick={onToggleChat} // Trigger the toggle function passed from parent
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${chatButtonClass}`}
                            title="Open Q&A / Comments"
                         >
                            <MessageSquare size={16} className="w-4 h-4"/> {/* Chat Icon */}
                            Q&A
                         </button>
                     )}
                     {/* Owner Buttons (Edit, Delete) */}
                     {isOwner && (
                         <>
                             {/* Edit Button (Links to edit page) */}
                             <Link
                                 href={`/placements/${drive.id}/edit`} // Correct link for editing this drive
                                 className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${editButtonClass}`}
                                 title="Edit drive details"
                             >
                                 <Edit size={16} className="w-4 h-4"/>
                                 Edit
                             </Link>
                             {/* Delete Button (Triggers modal via prop) */}
                             <button
                                onClick={onDeleteRequest} // Call the handler passed from parent
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${deleteButtonClass}`}
                                title="Delete drive"
                             >
                                  <Trash2 size={16} className="w-4 h-4"/>
                                 Delete
                             </button>
                         </>
                     )}
                </div>
            </div>

            {/* Bottom Section (Optional - currently empty) */}
            <div className="relative z-10 mt-auto pt-4">
                {/* Can display additional info like 'Posted By' if needed */}
            </div>
        </div>
    );
};

export default PlacementDriveBanner;