// components/ResourceCard.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Resource, ResourceType } from '@/lib/types/resource'; // Adjust path if needed
import { formatSimpleDate } from '@/lib/dateUtils'; // Adjust path if needed
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Adjust path if needed

// Import necessary icons from react-icons
import {
    FiFileText, FiFilm, FiLink, FiDatabase, FiFile, FiBookOpen, FiCode, FiImage, FiFolder, FiCpu
    // Add other icons relevant to your ResourceType values if needed
} from 'react-icons/fi';

// --- Helper Function: Get Type Details (Icon, Text Color, Hover Border Color Class) ---
// Provides styling hints based on the resource type for better visual identification.
const getResourceTypeDetails = (type: ResourceType | undefined): { Icon: React.ElementType, color: string, hoverBorderColorClass: string } => {
    switch (type) {
        case 'Notes':
            return { Icon: FiFileText, color: 'text-blue-700', hoverBorderColorClass: 'border-blue-400' };
        case 'Research Paper':
            return { Icon: FiBookOpen, color: 'text-purple-700', hoverBorderColorClass: 'border-purple-400' };
        case 'Book PDF':
            // Using FiBookOpen again, maybe differentiate color?
            return { Icon: FiBookOpen, color: 'text-red-700', hoverBorderColorClass: 'border-red-400' };
        case 'Question Bank':
            return { Icon: FiDatabase, color: 'text-indigo-700', hoverBorderColorClass: 'border-indigo-400' };
        case 'Video':
            return { Icon: FiFilm, color: 'text-rose-700', hoverBorderColorClass: 'border-rose-400' };
        case 'Presentation':
            return { Icon: FiImage, color: 'text-orange-700', hoverBorderColorClass: 'border-orange-400' };
        case 'Link Collection':
            return { Icon: FiLink, color: 'text-teal-700', hoverBorderColorClass: 'border-teal-400' };
        case 'Code Repository':
            return { Icon: FiCode, color: 'text-slate-700', hoverBorderColorClass: 'border-slate-400' };
        case 'Other':
        default:
            // Default fallback style
            return { Icon: FiFile, color: 'text-gray-600', hoverBorderColorClass: 'border-gray-400' };
    }
};

// --- Define the props the component expects ---
interface ResourceCardProps {
  resource: Resource; // The resource data object
  isFavorite?: boolean; // Optional: Is this resource marked as favorite?
  onToggleFavorite?: (resourceId: string) => void; // Optional: Function to handle favorite toggle
}

// --- Resource Card Component ---
const ResourceCard: React.FC<ResourceCardProps> = ({
    resource,
    isFavorite = false, // Default favorite state to false
    onToggleFavorite      // Handler function for toggling favorite (optional)
}) => {
    // --- Format Creation Date ---
    // Uses a utility function assumed to exist in lib/dateUtils.ts
    const creationDate = formatSimpleDate(resource.createdAt?.toString());

    // --- Get Resource Type Details ---
    const { Icon: TypeIcon, color: typeColor, hoverBorderColorClass } = getResourceTypeDetails(resource.resourceType);

    // --- Get Theme Styles for the top background ---
    // Uses a utility function assumed to exist in lib/themeUtils.ts, based on resource ID
    const theme = useMemo(() => getProjectThemeStyles(resource.id), [resource.id]);

    // --- Define internal link URL to the resource's detail page ---
    const resourceViewUrl = resource.id ? `/resources/${resource.id}` : '#'; // Fallback to '#' if ID is missing

    // --- Favorite Button Click Handler ---
    const handleFavoriteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault(); // Prevent the link navigation
        e.stopPropagation(); // Prevent event bubbling
        if (onToggleFavorite && resource.id) {
            onToggleFavorite(resource.id); // Call the parent's toggle function
        } else {
            console.error("Favorite toggle failed: Handler or Resource ID missing.");
        }
    };

    // --- Combine Category Tags for Display ---
    // Creates an array of non-empty detail strings (Branch, Year, Subject, College, Tags)
    const categoryTags = [
        resource.branch,
        resource.year,
        resource.subject,
        resource.college,
        ...(resource.tags || []) // Spread tags if they exist
    ].filter(Boolean) as string[]; // Filter out any null, undefined, or empty strings

    return (
        // Outer container:
        // - 'group' enables hover effects on child elements using 'group-hover:'.
        // - Starts with a 2px transparent border to prevent layout shifts on hover.
        // - On hover, the border color changes based on resource type using hoverBorderColorClass.
        <div className={`relative bg-white border-2 border-transparent rounded-xl shadow-md hover:shadow-lg group-hover:border-2 ${hoverBorderColorClass} transition-all duration-300 flex flex-col h-full group overflow-hidden`}>

             {/* Favorite Button (Top Right) */}
             {/* Only render if the onToggleFavorite function is provided */}
             {onToggleFavorite && (
                 <div className="absolute top-3 right-3 z-20 flex items-center">
                     <div className="flex items-center bg-white/70 backdrop-blur-sm rounded-full px-1 py-0.5 shadow-sm"> {/* Slightly increased opacity */}
                        <button
                            onClick={handleFavoriteClick}
                            className={`p-2 rounded-full transition-all duration-200 ease-in-out ${
                                isFavorite
                                    ? 'text-yellow-500 hover:bg-yellow-100/80' // Style when favorite
                                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50/80' // Style when not favorite
                                }`}
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                         >
                             {/* Star Icon */}
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                 <path fillRule="evenodd" d="M10.868 2.884c.321-.772 1.415-.772 1.736 0l1.681 4.065 4.48.653c.849.123 1.186 1.161.573 1.751l-3.242 3.158 0.766 4.461c.145.846-.734 1.49-1.467 1.084L10 15.547l-4.004 2.087c-.732.406-1.612-.238-1.467-1.084l.766-4.461-3.243-3.158c-.613-.59-.276-1.628.573-1.751l4.48-.653 1.681-4.065Z" clipRule="evenodd" />
                            </svg>
                        </button>
                     </div>
                 </div>
             )}

            {/* Main Clickable Link wrapping most of the card content */}
            <Link href={resourceViewUrl} className="flex flex-col flex-grow overflow-hidden cursor-pointer">

                {/* Themed Background Area (Top part of the card) */}
                <div className={`h-32 sm:h-36 w-full overflow-hidden relative ${theme.backgroundClasses}`}>
                    {/* Subtle overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-black/0 group-hover:from-black/0 group-hover:to-black/0 transition-colors duration-300"></div>
                </div>

                {/* Card Content Area */}
                 <div className="p-4 pb-3 flex flex-col flex-grow relative space-y-2">
                     {/* Uploader Avatar & Name (Overlapping style) */}
                     <div className="absolute -top-5 left-4 z-10 flex items-center pointer-events-none">
                        <img
                            src={resource.uploaderPhotoURL || '/default-avatar.png'}
                            alt={`${resource.uploaderName || 'Uploader'}'s avatar`}
                            className="w-10 h-10 rounded-full border-2 border-white shadow-md bg-gray-200 flex-shrink-0"
                            loading="lazy"
                        />
                        {/* Uploader Name Chip */}
                        <span
                            className="ml-2 text-sm font-medium text-gray-800 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm truncate pointer-events-auto max-w-[150px] sm:max-w-[180px]" // Increased text darkness slightly
                            title={resource.uploaderName}
                        >
                            {resource.uploaderName || 'Anonymous'}
                        </span>
                    </div>

                     {/* Content Below Avatar */}
                     <div className="pt-6 space-y-2.5"> {/* Increased spacing slightly */}
                        {/* Title */}
                        <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 transition-colors duration-200" title={resource.title}>
                            {resource.title || 'Untitled Resource'}
                        </h2>

                        {/* Description */}
                        <p className="text-xs text-gray-600 line-clamp-2 flex-grow min-h-[30px]"> {/* Ensures space even if empty */}
                            {resource.description || <span className="italic opacity-70">No description provided.</span>}
                        </p>

                        {/* Resource Type Identifier Badge */}
                        {resource.resourceType && (
                            <div className={`inline-flex items-center gap-1.5 py-0.5 px-2 rounded-full border border-gray-200 bg-gray-50 text-xs font-medium ${typeColor}`}> {/* Type-specific color */}
                                <TypeIcon className="w-3.5 h-3.5" /> {/* Icon for the type */}
                                <span>{resource.resourceType}</span>
                            </div>
                        )}

                        {/* Other Category Tags Section */}
                         {categoryTags.length > 0 && (
                             <div className="pt-1 min-h-[24px]"> {/* Provides minimum height */}
                                 <div className="flex flex-wrap gap-1.5 items-center">
                                     {/* Show first few category tags */}
                                     {categoryTags.slice(0, 4).map((tag, index) => (
                                         <span
                                            key={`${tag}-${index}`}
                                            className="text-[10px] bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700" // Subtle hover effect
                                            title={tag} // Show full tag on hover
                                        >
                                             {tag}
                                         </span>
                                     ))}
                                     {/* Indicate if more tags exist */}
                                     {categoryTags.length > 4 && (
                                         <span className="text-[10px] text-gray-400 whitespace-nowrap" title={`${categoryTags.length - 4} more details`}>
                                             + {categoryTags.length - 4} more
                                         </span>
                                     )}
                                 </div>
                             </div>
                         )}
                         {/* Fallback if no category tags were provided */}
                         {categoryTags.length === 0 && (
                              <div className="pt-1 min-h-[24px]">
                                  <span className="text-[10px] text-gray-400 italic">No additional details</span>
                              </div>
                         )}
                    </div>
                 </div>
                 {/* --- End Card Content Area --- */}


                 {/* --- Footer: Display only the Creation Date --- */}
                <div className="p-4 pt-2 mt-auto border-t border-gray-100 flex justify-end items-center text-xs text-gray-500">
                    {/* Creation Date */}
                    <div className="flex items-center flex-shrink-0 whitespace-nowrap" title={`Shared on: ${new Date(resource.createdAt.toString()).toLocaleString()}`}>
                         {/* Calendar Icon */}
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1 opacity-60"><path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 .75.75V3h6.5V2.5a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15.75 5.75v7.5A2.75 2.75 0 0 1 13 16H3A2.75 2.75 0 0 1 .25 13.25v-7.5A2.75 2.75 0 0 1 3 3h.25V2.5A.75.75 0 0 1 4 1.75ZM3.5 6a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Z" clipRule="evenodd" /></svg>
                        <span>{creationDate}</span> {/* Formatted Date */}
                    </div>
                </div>
                 {/* --- End Footer --- */}

            </Link> {/* --- End Main Clickable Link --- */}
        </div> // Close outer div
    );
};

export default ResourceCard;