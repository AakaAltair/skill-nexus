// components/PlacementCard.tsx
"use client";

import React from 'react';
// Link is not needed if the parent div handles the click for navigation
// import Link from 'next/link';
import { PlacementDrive, PlacementStatus } from '@/lib/types/placement'; // Adjust path if needed
import { formatSimpleDate } from '@/lib/dateUtils'; // Adjust path if needed
// Import necessary icons from lucide-react
import { Building2, MapPin, CalendarDays, CircleDollarSign, Briefcase, UserCircle, Star } from 'lucide-react';

// --- Helper Functions ---

/**
 * Determines the Tailwind CSS classes for the status badge based on the drive status.
 * @param status - The current status of the placement drive.
 * @returns A string of Tailwind classes for styling the badge.
 */
const getStatusBadgeStyle = (status: PlacementStatus | undefined): string => {
    switch (status) {
        case 'Ongoing':
            return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'Upcoming':
            return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'Past':
        case 'Cancelled': // Grouping Past and Cancelled visually
            return 'bg-gray-100 text-gray-700 border-gray-300';
        default:
            // Default style for unknown or undefined status
            return 'bg-gray-100 text-gray-700 border-gray-300';
    }
};

/**
 * Generates a placeholder background gradient class if no company logo is available.
 * Uses a simple hash of the drive ID to provide some variation.
 * @param id - The ID of the placement drive.
 * @returns A string containing Tailwind gradient classes.
 */
const getPlaceholderBg = (id: string | undefined): string => {
    const colors = [
        "bg-gradient-to-br from-cyan-50 to-blue-100",
        "bg-gradient-to-br from-green-50 to-emerald-100",
        "bg-gradient-to-br from-amber-50 to-orange-100",
        "bg-gradient-to-br from-purple-50 to-indigo-100",
        "bg-gradient-to-br from-pink-50 to-rose-100",
        "bg-gradient-to-br from-gray-100 to-gray-200", // Simple gray fallback
    ];
    let hash = 0;
    const safeId = id || Date.now().toString(); // Use ID or fallback
    for (let i = 0; i < safeId.length; i++) {
        hash = safeId.charCodeAt(i) + ((hash << 5) - hash); // Simple hash
        hash = hash & hash; // Convert to 32bit integer
    }
    return colors[Math.abs(hash) % colors.length]; // Use modulo to pick a color
};

// --- Props Interface ---
interface PlacementCardProps {
  drive: PlacementDrive; // Requires the PlacementDrive data object
  isFavorite?: boolean; // Optional: Is this drive marked as interested/favorite?
  onToggleFavorite?: (driveId: string) => void; // Optional: Function to handle favorite toggle
  // onClick is handled by the parent wrapper div in the list page
}

// --- Placement Card Component ---
const PlacementCard: React.FC<PlacementCardProps> = ({
    drive,
    isFavorite = false, // Default favorite state to false
    onToggleFavorite      // Handler function for toggling favorite (optional)
}) => {

    // --- Determine and Format a Key Date for Display ---
    // Prioritize showing the Application Deadline if available, then Test Date,
    // otherwise fallback to the creation date of the post.
    const displayDateInput = drive.keyDates?.applicationDeadline
        ? drive.keyDates.applicationDeadline
        : drive.keyDates?.testDate
            ? drive.keyDates.testDate
            : drive.createdAt; // Use createdAt as the final fallback

    // Set the label for the displayed date
    const displayDateLabel = drive.keyDates?.applicationDeadline
        ? 'Deadline'
        : drive.keyDates?.testDate
            ? 'Test Date'
            : 'Posted';

    // Format the determined date using the utility function
    const formattedDisplayDate = formatSimpleDate(displayDateInput?.toString());

    // --- Get Styles ---
    const statusBadgeClass = getStatusBadgeStyle(drive.status);
    const placeholderBgClass = getPlaceholderBg(drive.id);
    // Determine background for top section: Use placeholder if no logo, otherwise light gray/white
    const topSectionBgClass = drive.companyLogoURL ? 'bg-white p-4' : placeholderBgClass + ' p-4'; // Add padding

    // --- Image Error Handler ---
    // Replaces broken logo images with company initials
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const target = e.currentTarget;
        target.style.display = 'none'; // Hide the broken image
        const parent = target.parentElement;
        // Add placeholder styles and initials to the parent div
        if (parent) {
            parent.classList.add(...placeholderBgClass.split(' '), 'items-center', 'justify-center', 'flex'); // Ensure flex centering is applied
            parent.innerHTML = `<span class="text-3xl font-bold text-gray-400 opacity-80 select-none">${drive.companyName?.substring(0, 2).toUpperCase()}</span>`;
        }
    };

    // --- Favorite Button Click Handler ---
    const handleFavoriteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault(); // Prevent potential parent link navigation
        e.stopPropagation(); // Stop event from bubbling up to the card's main onClick
        if (onToggleFavorite && drive.id) {
            onToggleFavorite(drive.id); // Call the passed handler
        } else {
            console.error("Favorite toggle failed: Handler or Drive ID missing.");
        }
    };

    return (
        // Outer container - Base styles for the card
        // Hover effect (like border change) applied via parent page's 'group' class potentially
        <div className="bg-white border border-gray-200/80 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full overflow-hidden hover:border-gray-300 relative group"> {/* Added relative and group */}

             {/* --- Favorite Button (Top Right) --- */}
             {/* Render only if the onToggleFavorite function is provided */}
             {onToggleFavorite && (
                 <div className="absolute top-2 right-2 z-10"> {/* Positioned top-right */}
                     <button
                        onClick={handleFavoriteClick}
                        className={`p-1.5 rounded-full transition-all duration-200 ease-in-out ${
                            isFavorite
                                ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200' // Style when favorite
                                : 'bg-white/60 backdrop-blur-sm text-gray-400 hover:text-yellow-500 hover:bg-white/90' // Style when not favorite
                            }`}
                        aria-label={isFavorite ? "Remove from interested" : "Mark as interested"}
                        title={isFavorite ? "Remove from interested" : "Mark as interested"}
                    >
                        <Star size={16} className={isFavorite ? 'fill-current' : 'fill-none'} strokeWidth={isFavorite ? 0 : 2}/> {/* Filled/Outline star */}
                    </button>
                 </div>
             )}

            {/* Top Section: Company Logo or Placeholder */}
            <div className={`h-24 sm:h-28 w-full overflow-hidden relative flex items-center justify-center ${topSectionBgClass}`}>
                {drive.companyLogoURL ? (
                    <img
                        src={drive.companyLogoURL}
                        alt={`${drive.companyName} Logo`}
                        className="max-h-[80%] max-w-[75%] object-contain" // Ensure logo fits well
                        loading="lazy" // Lazy load images
                        onError={handleImageError} // Handle cases where the logo fails to load
                    />
                ) : (
                    // Display company initials as a placeholder if no logo URL
                    <span className="text-3xl font-bold text-gray-400 opacity-70 select-none">
                        {drive.companyName?.substring(0, 2).toUpperCase()}
                    </span>
                )}
                 {/* Optional subtle overlay */}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-transparent pointer-events-none"></div>
            </div>

            {/* Card Content Area */}
            <div className="p-4 flex flex-col flex-grow space-y-2.5"> {/* Main padding and spacing */}

                {/* Company Name (Prominent) */}
                <h2 className="text-base font-semibold text-gray-800 line-clamp-1 group-hover:text-blue-600" title={drive.companyName}> {/* Group hover from parent page's div */}
                    {drive.companyName || 'Company Not Specified'}
                </h2>

                {/* Role Title (Secondary) */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600" title={drive.roleTitle}>
                    <Briefcase size={14} className="text-gray-400 flex-shrink-0"/>
                    <span className="line-clamp-1">{drive.roleTitle || 'Role Not Specified'}</span>
                </div>

                {/* Key Info Snippets (Location, Date, Package) */}
                <div className="text-xs text-gray-500 space-y-1 pt-1">
                     {/* Location */}
                     {drive.location && (
                         <div className="flex items-center gap-1.5" title={`Location: ${drive.location}`}>
                             <MapPin size={13} className="flex-shrink-0 opacity-70" />
                             <span className="line-clamp-1">{drive.location}</span>
                         </div>
                     )}
                     {/* Key Date - Use the correctly defined formattedDisplayDate */}
                    {formattedDisplayDate && formattedDisplayDate !== 'Invalid date' && formattedDisplayDate !== 'Unknown date' && (
                        <div className="flex items-center gap-1.5" title={`${displayDateLabel}: ${formattedDisplayDate}`}>
                            <CalendarDays size={13} className="flex-shrink-0 opacity-70" />
                            {/* Display formatted date */}
                            <span>{displayDateLabel}: {formattedDisplayDate}</span>
                        </div>
                     )}
                      {/* Package Info Indicator */}
                      {drive.packageDetails && (
                         <div className="flex items-center gap-1.5" title="Package details available">
                             <CircleDollarSign size={13} className="flex-shrink-0 text-green-600 opacity-80" />
                             <span>Package details available</span>
                             {/* Or display package directly if simple and desired: <span>{drive.packageDetails}</span> */}
                         </div>
                     )}
                </div>
            </div>

            {/* Footer: Status Badge & Posted By Info */}
            <div className="p-3 px-4 mt-auto border-t border-gray-100 flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
                 {/* Status Badge */}
                 {drive.status && (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${statusBadgeClass}`}>
                        {drive.status}
                    </span>
                )}
                 {/* Posted By Info (Subtle) */}
                 <div className="flex items-center gap-1 text-xs text-gray-400" title={`Posted by ${drive.postedByName}`}>
                    <UserCircle size={14} className="opacity-70"/> {/* Generic user icon */}
                    <span className="truncate max-w-[100px]">{drive.postedByName || 'Admin'}</span> {/* Default to Admin */}
                 </div>
            </div>
        </div> // Close outer div
    );
};

export default PlacementCard;