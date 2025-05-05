// components/ClassroomBanner.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Project } from '@/lib/types/project'; // Adjust path if needed

interface ClassroomBannerProps {
    project: Project | null; // <-- Allow project to be potentially null initially
    isOwner: boolean;
    onDeleteRequest: () => void;
}

// --- Helper Functions ---
function formatDate(dateString: string | undefined, options?: Intl.DateTimeFormatOptions): string {
    if (!dateString) return 'N/A';
    const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    try {
        return new Date(dateString.toString()).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    } catch { return 'Invalid Date'; }
}

// Define Theme Structures
interface BannerTheme {
    id: number;
    name: string;
    backgroundClasses: string;
    primaryTextClass: string;
    secondaryTextClass: string;
    accentColorClass: string;
    buttonBaseClass: string;
    buttonHoverClass: string;
    statusBadgeStyle: (status: string | undefined) => string;
    skillTagStyle: (index: number) => string;
}

// --- Define Multiple Themes ---
const themes: BannerTheme[] = [
    // Theme 1: Abstract Blue/Purple Wave Gradient
    {
        id: 1, name: "Ocean Wave", backgroundClasses: "bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600",
        primaryTextClass: "text-white", secondaryTextClass: "text-indigo-100", accentColorClass: "text-blue-300",
        buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25",
        statusBadgeStyle: (status) => { /* ... */ return `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status === 'Completed' ? 'bg-green-400/30 text-green-100' : 'bg-white/10 text-indigo-100'}`; },
        skillTagStyle: (index) => `border border-white/30 text-white/90 bg-white/5 hover:bg-white/15`
    },
    // Theme 2: Warm Gradient (Red/Orange/Yellow)
    {
        id: 2, name: "Sunset Fade", backgroundClasses: "bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400",
        primaryTextClass: "text-white", secondaryTextClass: "text-red-100", accentColorClass: "text-yellow-200",
        buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25",
        statusBadgeStyle: (status) => { /* ... */ return `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status === 'In Progress' ? 'bg-blue-400/30 text-blue-100' : 'bg-white/10 text-red-100'}`; },
        skillTagStyle: (index) => `border border-white/30 text-white/90 bg-white/5 hover:bg-white/15`
    },
    // Theme 3: Geometric Minimal (Light)
    {
        id: 3, name: "Minimal Geo", backgroundClasses: "bg-white",
        primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600", accentColorClass: "text-blue-600",
        buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600",
        statusBadgeStyle: (status) => { /* ... */ const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border "; switch (status?.toLowerCase()) { case 'completed': return base + 'bg-green-100 text-green-800 border-green-300'; case 'in progress': return base + 'bg-blue-100 text-blue-800 border-blue-300'; case 'planning': case 'idea': return base + 'bg-yellow-100 text-yellow-800 border-yellow-300'; default: return base + 'bg-gray-100 text-gray-700 border-gray-300'; } },
        skillTagStyle: (index) => { const a = ['border-blue-300...', 'border-green-300...', 'border-yellow-300...', 'border-red-300...']; return `border bg-white text-xs px-3 py-1 rounded-full transition-colors ${a[index % a.length]}`; }
    },
    // Theme 4: Soft Teal/Green Abstract
    {
        id: 4, name: "Forest Mist", backgroundClasses: "bg-gradient-to-tl from-emerald-500 via-teal-500 to-cyan-600",
        primaryTextClass: "text-white", secondaryTextClass: "text-teal-100", accentColorClass: "text-emerald-300",
        buttonBaseClass: "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60", buttonHoverClass: "hover:bg-white/25",
        statusBadgeStyle: (status) => { /* ... */ return `border-white/30 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${status === 'Planning' ? 'bg-yellow-400/30 text-yellow-100' : 'bg-white/10 text-teal-100'}`; },
        skillTagStyle: (index) => `border border-white/30 text-white/90 bg-white/5 hover:bg-white/15`
    },
    // Theme 5: Default/Fallback (Subtle Gray Gradient) - Added as explicit fallback
    {
        id: 5, name: "Default Gray", backgroundClasses: "bg-gradient-to-br from-gray-50 via-gray-100 to-white",
        primaryTextClass: "text-gray-900", secondaryTextClass: "text-gray-600", accentColorClass: "text-blue-600",
        buttonBaseClass: "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50", buttonHoverClass: "hover:border-blue-500 hover:text-blue-600",
        statusBadgeStyle: (status) => { const base = "text-xs font-semibold px-2.5 py-0.5 rounded-full border "; return base + 'bg-gray-100 text-gray-700 border-gray-300'; },
        skillTagStyle: (index) => `border border-gray-300 bg-white text-xs px-3 py-1 rounded-full transition-colors hover:bg-gray-50`
    },
];


const ClassroomBanner: React.FC<ClassroomBannerProps> = ({ project, isOwner, onDeleteRequest }) => {

    // --- Select Theme Randomly based on Project ID (Safely) ---
    const selectedTheme = useMemo(() => {
        let hash = 0;
        // Use optional chaining and provide a fallback if project or project.id is null/undefined
        const id = project?.id || Date.now().toString() + Math.random(); // Use random fallback for initial render if needed
        if (id) {
             for (let i = 0; i < id.length; i++) {
                hash = id.charCodeAt(i) + ((hash << 5) - hash);
             }
        }
        const themeIndex = Math.abs(hash) % themes.length;
        // Return the selected theme or the last one (default gray) as a final fallback
        const theme = themes[themeIndex] || themes[themes.length - 1];
        console.log("Selected Theme:", theme.name); // For debugging
        return theme;
    // Depend on project?.id - useMemo re-runs if project.id changes from null/undefined to a value
    }, [project?.id]);

    // --- Render placeholder or null if project data is not yet available ---
    if (!project) {
         // You can return a loading skeleton or null here
         // Returning a placeholder div with fixed height matching the banner's min-height
         return <div className="w-full rounded-xl shadow-lg mb-8 md:mb-10 bg-gray-100 animate-pulse min-h-[260px]"></div>;
    }

    // --- Owner Button Styling (Calculated after project exists) ---
    const editButtonClass = `${selectedTheme.buttonBaseClass} ${selectedTheme.buttonHoverClass}`;
    const deleteButtonBase = selectedTheme.id === 3 // Specific style for light theme delete button
        ? "border-gray-300 bg-white text-gray-800 shadow-sm hover:border-red-500 hover:bg-red-50 hover:text-red-700"
        : selectedTheme.buttonBaseClass + " hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-50"; // Dark theme delete button
    const deleteButtonClass = `${deleteButtonBase}`;


    return (
        <div
            // Apply theme background, padding, shadow etc.
            className={`w-full rounded-xl shadow-lg mb-8 md:mb-10 relative overflow-hidden p-8 md:p-10 lg:p-12 ${selectedTheme.backgroundClasses} min-h-[260px] flex flex-col justify-between`}
        >
            {/* Top Section: Title, Meta, Owner Buttons */}
            <div className="relative z-10 flex justify-between items-start gap-4">
                {/* Left: Title & Essential Meta */}
                <div className="flex-1 min-w-0">
                    <h1 className={`text-3xl md:text-4xl font-bold mb-2 break-words leading-tight ${selectedTheme.primaryTextClass}`}>
                        {project.title}
                    </h1>
                     {/* Meta: Type, Status, Creator */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm mb-4 ${selectedTheme.secondaryTextClass}`}>
                         {/* Type Badge */}
                        <span className={selectedTheme.statusBadgeStyle('Type')}> {/* Use statusBadgeStyle or define unique */}
                            {project.projectType} Project
                        </span>
                        {/* Status Badge */}
                        {project.status && (
                           <span className={selectedTheme.statusBadgeStyle(project.status)}>
                               {project.status}
                           </span>
                        )}
                         {/* Creator */}
                        <div className="flex items-center shrink-0" title={`Creator: ${project.creatorName || 'Unknown'}`}>
                            <img src={project.creatorPhotoURL || '/default-avatar.png'} alt="" className="w-5 h-5 rounded-full mr-1.5 border border-current opacity-50"/>
                            <span className="opacity-90">{project.creatorName || 'Unknown'}</span>
                        </div>
                         {/* Date */}
                        <div className="flex items-center shrink-0" title={`Created: ${formatDate(project.createdAt?.toString())}`}>
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 mr-1 opacity-70"><path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 .75.75V3h6.5V2.5a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15.75 5.75v7.5A2.75 2.75 0 0 1 13 16H3A2.75 2.75 0 0 1 .25 13.25v-7.5A2.75 2.75 0 0 1 3 3h.25V2.5A.75.75 0 0 1 4 1.75ZM3.5 6a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Z" clipRule="evenodd" /></svg>
                              <span className="opacity-90">{formatDate(project.createdAt?.toString(), {month: 'short', day: 'numeric'})}</span>
                        </div>
                         {/* Location */}
                        {project.location && (
                           <div className="flex items-center shrink-0" title={`Location: ${project.location}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 mr-1 opacity-70"><path fillRule="evenodd" d="m7.539 14.841.003.002a.75.75 0 0 0 .918 0l.003-.002.006-.003.018-.007a4.997 4.997 0 0 0 .277-.138l.002-.001.006-.004.012-.007a.69.69 0 0 0 .11-.054.703.703 0 0 0 .3-.241l.004-.005a3.7 3.7 0 0 0 .35-3.493l-2.754-6.425a.75.75 0 0 0-1.372 0L5.472 10.9l-.002.005a3.7 3.7 0 0 0 .35 3.493l.004.005a.703.703 0 0 0 .3.241.69.69 0 0 0 .11.054l.012.007.006.004.002.001a4.997 4.997 0 0 0 .277.138l.018.007.006.003ZM8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" /></svg>
                               <span className="opacity-90 truncate max-w-[150px]">{project.location}</span>
                          </div>
                        )}
                    </div>
                </div>

                 {/* Right: Owner Buttons */}
                 {isOwner && (
                    <div className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 md:mt-0 flex-shrink-0">
                        <Link
                             href={`/projects/${project.id}/edit`}
                             className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${editButtonClass}`}
                             title="Edit project details"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M11.14 2.857a.75.75 0 0 1 1.06 0l1.943 1.943a.75.75 0 0 1 0 1.06l-9.193 9.193a.75.75 0 0 1-.397.215l-3.25.812a.75.75 0 0 1-.918-.918l.812-3.25a.75.75 0 0 1 .215-.397l9.193-9.193ZM12.44 4.187l-7.344 7.344-1.13 1.13a.75.75 0 0 0 1.06 1.061l.113-.113L13.5 4.187l-.253-.253Z" clipRule="evenodd" /></svg>
                            Edit
                        </Link>
                         <button
                            onClick={onDeleteRequest}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-xs font-medium transition-colors duration-150 ${deleteButtonClass}`}
                            title="Delete project"
                         >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.5-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" /></svg>
                             Delete
                         </button>
                    </div>
                 )}
            </div>

            {/* Bottom Section: Description & Skills */}
            <div className="relative z-10 mt-auto pt-6">
                {/* Description */}
                {project.description && (
                    <p className={`text-base mb-5 leading-relaxed line-clamp-2 ${selectedTheme.secondaryTextClass} ${selectedTheme.id !== 3 ? 'opacity-90' : '' }`} title={project.description}>
                        {project.description}
                    </p>
                 )}
                 {/* Skills */}
                 {(project.skills && project.skills.length > 0) && (
                     <div className="mt-4">
                         <h3 className={`text-xs font-semibold mb-2 uppercase tracking-wider ${selectedTheme.secondaryTextClass} opacity-80`}>Skills</h3>
                         <div className="flex flex-wrap gap-2">
                            {project.skills.slice(0, 8).map((skill, index) => (
                                <span key={skill} className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors duration-150 ${selectedTheme.skillTagStyle(index)}`}>
                                    {skill}
                                </span>
                             ))}
                             {project.skills.length > 8 && (
                                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${selectedTheme.id === 3 ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-black/10 text-current opacity-70 border-current/30'}`}>
                                    + {project.skills.length - 8} more
                                </span>
                            )}
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default ClassroomBanner;