// components/ProjectCard.tsx
"use client"; // Required for useMemo

import Link from 'next/link';
import React, { useMemo } from 'react'; // Import useMemo
import { Project } from '@/lib/types/project'; // Adjust path if needed
// --- Import the date formatters ---
import { formatTimestamp, formatSimpleDate } from '@/lib/dateUtils'; // Adjust path
// --- Import the new theme utility ---
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Adjust path

// --- Define the props the component expects ---
interface ProjectCardProps {
  project: Project;
  isFavorite: boolean;
  onToggleFavorite: (projectId: string) => void;
  isOwner?: boolean;
  onDeleteClick?: (project: Project) => void;
}

// --- Project Card Component ---
const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    isFavorite,
    onToggleFavorite,
    isOwner = false,
    onDeleteClick
}) => {
    // --- Use date formatters ---
    const creationDate = formatSimpleDate(project.createdAt?.toString()); // Simple date for footer
    const lastUpdateTime = formatTimestamp(project.updatedAt?.toString());   // Relative time for top-left

    // --- Get Theme Styles using the utility ---
    // This is used *only* for the image placeholder background
    const theme = useMemo(() => getProjectThemeStyles(project.id), [project.id]);

    // Determine accent color for status based on project status
    const statusColorClasses = (): string => {
        switch (project.status?.toLowerCase()) {
            case 'completed': return 'bg-green-50 text-green-800 border-green-300';
            case 'in progress': return 'bg-blue-50 text-blue-800 border-blue-300';
            case 'planning': case 'idea': return 'bg-yellow-50 text-yellow-800 border-yellow-300';
            case 'paused': case 'archived': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    // --- Event Handlers ---
    const handleFavoriteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault(); e.stopPropagation();
        if (project.id) onToggleFavorite(project.id);
        else console.error("Favorite toggle failed: Project ID missing.");
    };

    const handleDeleteRequest = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault(); e.stopPropagation();
        if (onDeleteClick && project.id) onDeleteClick(project);
        else console.error("Delete request failed: Handler or Project ID missing.");
    };

    // --- Define URLs with fallbacks ---
    const projectViewUrl = project.id ? `/projects/${project.id}` : '#';
    const projectEditUrl = project.id ? `/projects/${project.id}/edit` : '#';


    return (
        // Outer container: Structure and classes from your provided code
        <div className="relative bg-white border border-gray-200/80 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col h-full group overflow-hidden">

            {/* --- Last Update Time (Top Left) --- */}
             <div
                className="absolute top-3 left-3 z-10 bg-white/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-gray-600 text-[10px] flex items-center gap-1"
                title={`Last updated: ${new Date(project.updatedAt.toString()).toLocaleString()}`}
            >
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 opacity-70"><path fillRule="evenodd" d="M13.75 3a2.25 2.25 0 0 0-2.25 2.25v.943a6.973 6.973 0 0 1-3.3 2.986 6.972 6.972 0 0 1-3.3-2.986V5.25A2.25 2.25 0 0 0 2.25 3a.75.75 0 0 0 0 1.5 1.664 1.664 0 0 1 .83 1.5H3a.75.75 0 0 0 0 1.5h.08a5.472 5.472 0 0 0 3.018 4.235 8.47 8.47 0 0 0 3.804 0 5.472 5.472 0 0 0 3.018-4.235H13a.75.75 0 0 0 0-1.5h-.08A1.665 1.665 0 0 1 13.75 4.5a.75.75 0 0 0 0-1.5ZM8 10.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" clipRule="evenodd" /></svg>
                <span>{lastUpdateTime}</span>
            </div>
            {/* --- End Last Update Time --- */}

            {/* --- Action Buttons (Top Right) - Structure and classes from your provided code --- */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
                 <div className="flex items-center gap-1 bg-white/60 backdrop-blur-sm rounded-full px-1 py-0.5 shadow-sm">
                     {isOwner && (
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                             {onDeleteClick && (
                                 <button onClick={handleDeleteRequest} className="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition-all duration-200 ease-in-out" aria-label="Delete project" title="Delete project">
                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"> <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H4.084a2.25 2.25 0 0 1-2.244-2.077L1.03 5.79m13.71 0a48.108 48.108 0 0 0-3.478-.397m-9.988 0a48.108 48.108 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /> </svg>
                                 </button>
                             )}
                            <Link href={projectEditUrl} onClick={(e) => e.stopPropagation()} className="p-2 rounded-full text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-all duration-200 ease-in-out" aria-label="Edit project" title="Edit project">
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4"> <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8L2.685 19.13a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /> </svg>
                            </Link>
                        </div>
                     )}
                    <button onClick={handleFavoriteClick} className={`p-2 rounded-full transition-all duration-200 ease-in-out ${ isFavorite ? 'text-yellow-500 hover:bg-yellow-100/70' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50/80'}`} aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10.868 2.884c.321-.772 1.415-.772 1.736 0l1.681 4.065 4.48.653c.849.123 1.186 1.161.573 1.751l-3.242 3.158 0.766 4.461c.145.846-.734 1.49-1.467 1.084L10 15.547l-4.004 2.087c-.732.406-1.612-.238-1.467-1.084l.766-4.461-3.243-3.158c-.613-.59-.276-1.628.573-1.751l4.48-.653 1.681-4.065Z" clipRule="evenodd" /></svg>
                    </button>
                 </div>
            </div>
            {/* --- End Action Buttons --- */}

            {/* --- Main Clickable Link --- */}
            <Link href={projectViewUrl} className="flex flex-col flex-grow overflow-hidden cursor-pointer">

                {/* Cover Image Area - UPDATED PLACEHOLDER BACKGROUND */}
                <div className="h-32 sm:h-36 w-full bg-gray-100 overflow-hidden relative"> {/* Keep outer structure */}
                    {project.coverImageURL ? (
                        <img src={project.coverImageURL} alt={`${project.title || 'Project'} cover`} className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105" loading="lazy" />
                    ) : (
                         // ONLY CHANGE: Apply theme background to the placeholder div
                         <div className={`h-full w-full flex items-center justify-center ${theme.backgroundClasses}`}>
                            {/* Placeholder content (optional, e.g., initials or simple icon) */}
                            {/* <span className="text-4xl font-bold text-white/30 select-none">
                                {project.title?.charAt(0).toUpperCase()}
                            </span> */}
                         </div>
                    )}
                    {/* Overlay remains unchanged */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-black/5 group-hover:from-black/5 group-hover:to-black/0 transition-colors duration-300"></div>
                </div>

                 {/* Card Content Area - Structure and classes from your provided code */}
                 <div className="p-4 pb-3 flex flex-col flex-grow relative space-y-2">
                     {/* Creator Avatar & Name (Overlapping - Preserved) */}
                     <div className="absolute -top-5 left-4 z-10 flex items-center pointer-events-none">
                        <img src={project.creatorPhotoURL || '/default-avatar.png'} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-md bg-gray-200 flex-shrink-0" loading="lazy"/>
                        <span className="ml-2 text-sm font-medium text-gray-700 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm truncate pointer-events-auto" title={project.creatorName}>{project.creatorName || 'Unknown Creator'}</span>
                    </div>

                     {/* Content Below Avatar - Structure and classes from your provided code */}
                     <div className="pt-6">
                        {/* Title */}
                        <h2 className="text-base font-semibold mb-1.5 text-black group-hover:text-blue-600 line-clamp-2 transition-colors duration-200" title={project.title}>
                            {project.title || 'Untitled Project'}
                        </h2>
                        {/* Description */}
                        <p className="text-xs text-gray-600 mb-3 line-clamp-3 flex-grow min-h-[45px]">
                            {project.description || <span className="italic opacity-70">No description provided.</span>}
                        </p>
                        {/* Type & Status Badges */}
                        <div className="flex items-center text-xs text-gray-600 mb-4 space-x-2 flex-wrap gap-y-1">
                            {project.projectType && ( <span className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200/80 text-[11px] font-medium"> {project.projectType} </span> )}
                            {project.status && ( <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-medium ${statusColorClasses()}`}> {project.status} </span> )}
                        </div>
                        {/* Skills Section */}
                         {(project.skills && project.skills.length > 0) && (
                            <div className="mb-2 min-w-0 h-[23px]">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {project.skills.slice(0, 4).map(skill => (
                                        <span key={skill} className="text-[10px] bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
                                            {skill}
                                        </span>
                                    ))}
                                    {project.skills.length > 4 && <span className="text-[10px] text-gray-400">+{project.skills.length - 4} more</span>}
                                </div>
                            </div>
                         )}
                         {(!project.skills || project.skills.length === 0) && (
                             <div className="mb-2 min-w-0 h-[23px]">
                                <span className="text-[10px] text-gray-400 italic">No skills listed</span>
                             </div>
                         )}
                    </div>
                 </div>
                 {/* --- End Card Content Area --- */}


                 {/* --- Footer: Location & CREATION Date - Structure and classes from your provided code --- */}
                <div className="p-4 pt-2 mt-auto border-t border-gray-100 flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {/* Location */}
                    <div className="flex items-center min-w-0 overflow-hidden" title={project.location || 'Location not specified'}>
                         {project.location ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1 opacity-60 flex-shrink-0"><path fillRule="evenodd" d="m7.539 14.841.003.002a.75.75 0 0 0 .918 0l.003-.002.006-.003.018-.007a4.997 4.997 0 0 0 .277-.138l.002-.001.006-.004.012-.007a.69.69 0 0 0 .11-.054.703.703 0 0 0 .3-.241l.004-.005a3.7 3.7 0 0 0 .35-3.493l-2.754-6.425a.75.75 0 0 0-1.372 0L5.472 10.9l-.002.005a3.7 3.7 0 0 0 .35 3.493l.004.005a.703.703 0 0 0 .3.241.69.69 0 0 0 .11.054l.012.007.006.004.002.001a4.997 4.997 0 0 0 .277.138l.018.007.006.003ZM8 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" /></svg>
                                <span className="truncate max-w-[120px]">{project.location}</span>
                            </>
                         ) : (
                            <span className="italic opacity-70">No location</span>
                         )}
                    </div>
                     {/* Creation Date */}
                    <div className="flex items-center flex-shrink-0 whitespace-nowrap" title={`Created on: ${new Date(project.createdAt.toString()).toLocaleString()}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1 opacity-60"><path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 .75.75V3h6.5V2.5a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15.75 5.75v7.5A2.75 2.75 0 0 1 13 16H3A2.75 2.75 0 0 1 .25 13.25v-7.5A2.75 2.75 0 0 1 3 3h.25V2.5A.75.75 0 0 1 4 1.75ZM3.5 6a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Z" clipRule="evenodd" /></svg>
                        <span>{creationDate}</span> {/* Use simple creation date */}
                    </div>
                </div>
                 {/* --- End Footer --- */}
            </Link>
             {/* --- End Main Clickable Link --- */}
        </div> // Close outer div
    );
};

export default ProjectCard;