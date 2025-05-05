// components/LearningClassroomBanner.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { LearningClassroom } from '@/lib/types/learning'; // Import the new type

// Assuming getProjectThemeStyles can generate themes based on *any* ID string
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Adjust path if needed

// Import necessary icons (example: Edit, Delete, Chat)
import { FiEdit, FiTrash2, FiMessageSquare, FiArrowLeft } from 'react-icons/fi'; // From react-icons

interface LearningClassroomBannerProps {
    // Change prop name from 'project' to 'classroom' and use the new type
    classroom: LearningClassroom | null; // Allow null while loading
    // Change prop name from 'isOwner' to 'isTeacher' for clarity in this context
    isTeacher: boolean;
    // Placeholder for delete handler - will implement later
    // onDeleteRequest: () => void;
    // New prop to toggle the chat sidebar
    onToggleChatSidebar: () => void;
}

// --- Helper Functions ---
// Re-use or adapt your date formatting utility
function formatDateSimple(dateString: string | Date | Timestamp | undefined): string {
    if (!dateString) return 'N/A';
    try {
         // Handle Firebase Timestamp object if necessary
        if (typeof (dateString as Timestamp).toDate === 'function') {
             return new Date((dateString as Timestamp).toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
         // Handle ISO string or Date object
         return new Date(dateString.toString()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return 'Invalid Date'; }
}

// --- Re-define Themes (can reuse your existing themes or define new ones) ---
// Ensure these themes are suitable for a classroom context
interface BannerTheme {
    id: number;
    name: string;
    backgroundClasses: string;
    primaryTextClass: string; // For title
    secondaryTextClass: string; // For meta info and description
    // Add styles for badges if needed within the banner
    metaBadgeStyle: (key: string, value: string) => string; // Example style based on meta key/value
    buttonBaseClass: string; // Base style for action buttons
    buttonHoverClass: string; // Hover style for action buttons
}

// Example Themes (adapt from your ClassroomBanner.tsx)
// Make sure theme.hoverBorderClass is NOT used here, only in cards
const themes: BannerTheme[] = [
    // Theme 1: Abstract Blue/Purple Wave Gradient
    {
        id: 1, name: "Ocean Wave", backgroundClasses: "bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600",
        primaryTextClass: "text-white", secondaryTextClass: "text-indigo-100",
        metaBadgeStyle: (key, value) => `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-white/10 text-indigo-100`, // Generic badge
        buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25",
    },
     // Theme 3: Geometric Minimal (Light) - Often good for official feel
     {
        id: 3, name: "Minimal Geo", backgroundClasses: "bg-white border border-gray-200", // Added border for light theme
        primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600",
        metaBadgeStyle: (key, value) => { // More distinct badges for light theme
            const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border ";
             if (key === 'academicYear') return base + 'bg-blue-100 text-blue-800 border-blue-300';
             if (key === 'semester') return base + 'bg-green-100 text-green-800 border-green-300';
             if (key === 'branch') return base + 'bg-purple-100 text-purple-800 border-purple-300';
             if (key === 'year') return base + 'bg-yellow-100 text-yellow-800 border-yellow-300';
             return base + 'bg-gray-100 text-gray-700 border-gray-300';
         },
        buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600",
     },
    // ... Include other themes from your ClassroomBanner.tsx as desired
    // Ensure a default/fallback theme is always available
     {
        id: 5, name: "Default Gray", backgroundClasses: "bg-gradient-to-br from-gray-50 via-gray-100 to-white",
        primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600",
        metaBadgeStyle: (key, value) => "text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-gray-100 text-gray-700 border-gray-300",
        buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600",
     },
];

// Function to select a theme based on ID (from themeUtils, ensure consistency)
// This function should be the same one used by the card component
// If your themeUtils calculates this based on ID, just use that.
// If not, implement it here or in a shared utility.
// For now, let's assume getProjectThemeStyles from themeUtils is robust
// enough to take any ID string and return one of the themes defined above (or similar).
// We might need to adjust themeUtils or replicate its logic if it's coupled to Project themes.
// Let's replicate a basic hashing logic here for demonstration, assuming themeUtils
// either uses this logic OR you will align it.
const getLearningClassroomTheme = (id: string | undefined): BannerTheme => {
    if (!id) return themes[themes.length - 1]; // Default fallback

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const themeIndex = Math.abs(hash) % themes.length;
    // Return the selected theme, with the last theme as a failsafe fallback
    return themes[themeIndex] || themes[themes.length - 1];
};


const LearningClassroomBanner: React.FC<LearningClassroomBannerProps> = ({
    classroom,
    isTeacher, // Use isTeacher prop
    // onDeleteRequest,
    onToggleChatSidebar, // New prop
}) => {

    // --- Select Theme based on Classroom ID ---
    const selectedTheme = useMemo(() => getLearningClassroomTheme(classroom?.id), [classroom?.id]);

    // --- Render placeholder or null if classroom data is not yet available ---
    if (!classroom) {
         // Return a placeholder div matching the banner's expected size
         return <div className={`w-full rounded-xl shadow-lg mb-8 md:mb-10 ${selectedTheme.backgroundClasses} animate-pulse min-h-[260px]`}></div>;
    }

    // --- Button Styling (Calculated after classroom exists) ---
    const editButtonClass = `${selectedTheme.buttonBaseClass} ${selectedTheme.buttonHoverClass}`;
    const deleteButtonBase = selectedTheme.id === 3 // Specific style for light theme delete button
        ? "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-red-500 hover:bg-red-50 hover:text-red-700"
        : selectedTheme.buttonBaseClass + " hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-50"; // Dark theme delete button
    const deleteButtonClass = `${deleteButtonBase}`;
     const chatButtonClass = `${selectedTheme.buttonBaseClass} ${selectedTheme.buttonHoverClass}`;


    return (
        // Apply theme background, padding, shadow etc.
        <div
            className={`w-full rounded-xl shadow-lg mb-8 md:mb-10 relative overflow-hidden p-8 md:p-10 lg:p-12 ${selectedTheme.backgroundClasses} min-h-[260px] flex flex-col justify-between`}
        >
            {/* Top Section: Title, Meta, Owner/Action Buttons */}
            <div className="relative z-10 flex justify-between items-start gap-4 flex-wrap md:flex-nowrap"> {/* Allow wrapping on smaller screens */}
                {/* Left: Title & Essential Meta */}
                <div className="flex-1 min-w-0">
                    {/* Updated Title to use classroom.name */}
                    <h1 className={`text-3xl md:text-4xl font-bold mb-2 break-words leading-tight ${selectedTheme.primaryTextClass}`}>
                        {classroom.name}
                    </h1>
                     {/* Meta: Academic Details (Year, Sem, Branch, etc.) */}
                     {/* Map and display meta tags as badges using theme styling */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm mb-4 ${selectedTheme.secondaryTextClass}`}>
                         {/* Display Academic Year, Year, Sem, Branch etc. as badges */}
                         {classroom.academicYear && (
                             <span className={selectedTheme.metaBadgeStyle('academicYear', classroom.academicYear)}>
                                {classroom.academicYear}
                             </span>
                         )}
                          {classroom.year && (
                             <span className={selectedTheme.metaBadgeStyle('year', classroom.year)}>
                                Year {classroom.year}
                             </span>
                         )}
                         {classroom.semester && (
                             <span className={selectedTheme.metaBadgeStyle('semester', classroom.semester)}>
                                {classroom.semester}
                             </span>
                         )}
                         {classroom.branch && (
                             <span className={selectedTheme.metaBadgeStyle('branch', classroom.branch)}>
                                {classroom.branch}
                             </span>
                         )}
                         {/* Add other optional meta (class, division, batch) here as badges if desired */}
                         {classroom.class && (
                             <span className={selectedTheme.metaBadgeStyle('class', classroom.class)}>
                                Class {classroom.class}
                             </span>
                         )}
                          {classroom.batch && (
                             <span className={selectedTheme.metaBadgeStyle('batch', classroom.batch)}>
                                Batch {classroom.batch}
                             </span>
                         )}


                         {/* Creator Info (Optional, can add if needed) */}
                         {/* <div className="flex items-center shrink-0" title={`Created by: ${classroom.creatorName || 'Unknown'}`}> ... </div> */}

                         {/* Creation Date */}
                         {classroom.createdAt && (
                            <div className="flex items-center shrink-0" title={`Created: ${new Date(classroom.createdAt.toString()).toLocaleString()}`}>
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 mr-1 ${selectedTheme.secondaryTextClass}`}>
                                     <path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 .75.75V3h6.5V2.5a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15.75 5.75v7.5A2.75 2.75 0 0 1 13 16H3A2.75 2.75 0 0 1 .25 13.25v-7.5A2.75 2.75 0 0 1 3 3h.25V2.5A.75.75 0 0 1 4 1.75ZM3.5 6a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Z" clipRule="evenodd" />
                                 </svg>
                                  <span className="opacity-90">{formatDateSimple(classroom.createdAt)}</span>
                            </div>
                         )}
                    </div>
                </div>

                 {/* Right: Action Buttons */}
                 {/* Show buttons based on isTeacher prop */}
                 <div className="relative z-20 flex flex-row items-center gap-2 mt-2 md:mt-0 flex-shrink-0">
                      {/* Back Button (Useful on detail pages) */}
                     <button
                          onClick={() => router.back()}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${selectedTheme.buttonBaseClass} ${selectedTheme.buttonHoverClass}`}
                          title="Go back"
                      >
                         <FiArrowLeft className="w-4 h-4" /> Back
                     </button>

                      {/* Toggle Chat Sidebar Button */}
                     <button
                         onClick={onToggleChatSidebar}
                         className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${chatButtonClass}`}
                         title="Toggle Q&A / Comments"
                     >
                         <FiMessageSquare className="w-4 h-4" /> Q&A
                     </button>


                     {/* Edit Button (Teacher Only) */}
                     {isTeacher && (
                        <Link
                             href={`/learning/${classroom.id}/edit`} // Link to edit page
                             className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${editButtonClass}`}
                             title="Edit classroom details"
                        >
                             <FiEdit className="w-4 h-4"/> Edit
                        </Link>
                     )}
                      {/* Delete Button (Teacher Only - Placeholder) */}
                      {/* {isTeacher && onDeleteRequest && (
                         <button
                            onClick={onDeleteRequest}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${deleteButtonClass}`}
                            title="Delete classroom"
                         >
                              <FiTrash2 className="w-4 h-4"/> Delete
                         </button>
                      )} */}
                 </div>
            </div>

            {/* Bottom Section: Description */}
            <div className="relative z-10 mt-auto pt-6">
                {/* Description */}
                {classroom.description && (
                    <p className={`text-base mb-0 leading-relaxed line-clamp-3 ${selectedTheme.secondaryTextClass} ${selectedTheme.id !== 3 ? 'opacity-90' : '' }`} title={classroom.description}>
                        {classroom.description}
                    </p>
                 )}
            </div>
        </div>
    );
};

export default LearningClassroomBanner;