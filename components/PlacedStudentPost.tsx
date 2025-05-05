// components/PlacedStudentPost.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link'; // For linking student name and creator name
import { StudentAchievement, PlacementType } from '@/lib/types/placement'; // Adjust path if needed
import { formatTimestamp } from '@/lib/dateUtils'; // Adjust path if needed
// Import required Lucide icons
import { Building2, GraduationCap, Briefcase, MessageSquare, Code2, IndianRupee, MapPin } from 'lucide-react';

// --- Props Interface ---
interface PlacedStudentPostProps {
    achievement: StudentAchievement; // Requires the achievement data object
    // onClick handler removed as Link wraps the component
}

// --- Helper Function: Get Styling based on Placement Type ---
// Returns Tailwind classes for badge background/text and top border color
const getTypeSpecificStyles = (type: PlacementType | undefined): { badgeClasses: string, borderClass: string } => {
    switch (type) {
        case 'Full-time':
            return { badgeClasses: 'bg-green-900/50 text-green-300 border-green-700/50', borderClass: 'border-t-green-500' };
        case 'Internship':
            return { badgeClasses: 'bg-blue-900/50 text-blue-300 border-blue-700/50', borderClass: 'border-t-blue-500' };
        case 'PPO': // Pre-Placement Offer
            return { badgeClasses: 'bg-purple-900/50 text-purple-300 border-purple-700/50', borderClass: 'border-t-purple-500' };
        case 'Other':
        default:
            // Default style for 'Other' or undefined type
            return { badgeClasses: 'bg-gray-700/50 text-gray-300 border-gray-600/50', borderClass: 'border-t-gray-500' };
    }
};

// --- Helper Function: Select a UNIQUE Dark Gradient Theme ---
// Provides different base dark color gradients for visual variety
const getUniqueDarkGradientClass = (id: string | undefined): string => {
    const gradients = [
        "from-gray-900 via-purple-950 to-slate-900",
        "from-slate-900 via-blue-950 to-indigo-950",
        "from-gray-900 via-emerald-950 to-teal-950",
        "from-slate-900 via-rose-950 to-red-950",
        "from-gray-900 via-violet-950 to-purple-950",
        "from-slate-900 via-sky-950 to-cyan-950",
        "from-neutral-900 via-gray-800 to-slate-900",
        "from-zinc-900 via-stone-800 to-neutral-950"
    ];
    let hash = 0;
    const safeId = id || Date.now().toString(); // Use ID or fallback
    for (let i = 0; i < safeId.length; i++) {
        hash = safeId.charCodeAt(i) + ((hash << 5) - hash); // Simple hash
        hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % gradients.length; // Use modulo to pick a gradient
    return gradients[index];
};

// --- Placed Student Post Component ---
// Renders a single achievement card with a dark theme, focusing on placed student info.
const PlacedStudentPost: React.FC<PlacedStudentPostProps> = ({ achievement }) => {

    // Format the timestamp using the relative time utility
    const postTimestamp = formatTimestamp(achievement.createdAt.toString());
    // Get the type-specific styling classes for badge and border
    const { badgeClasses: typeBadgeClass, borderClass: typeBorderClass } = getTypeSpecificStyles(achievement.placementType);
    // Get a unique dark gradient for this card's background
    const darkGradientClass = useMemo(() => getUniqueDarkGradientClass(achievement.id), [achievement.id]);

    // Define URL for the detail page (if ID exists)
    // Note: This assumes a detail page route exists at this path
    const detailUrl = achievement.id ? `/placements/achievements/${achievement.id}` : '#';

    // Optional: URL to the creator's profile if you have profile pages
    const creatorProfileUrl = `/profile/${achievement.creatorId}`; // Adjust path as needed

    // Basic error handler for company logo (hides broken image)
    const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        e.currentTarget.style.display = 'none';
    };

    // Basic error handler for creator avatar
     const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
         e.currentTarget.src = '/default-avatar.png'; // Fallback to default avatar
     };

    return (
        // Card Container: Wrapped in a Link to its detail page
        <Link href={detailUrl} legacyBehavior>
            <a className={`w-full break-inside-avoid-column mb-4 overflow-hidden rounded-xl shadow-lg bg-gradient-to-br ${darkGradientClass} text-white flex flex-col h-full p-5 border-t-4 ${typeBorderClass} block hover:shadow-xl transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-purple-500`}>

                {/* Header: Placed Student Name, Branch/Year */}
                {/* No creator avatar here */}
                <div className="mb-4 border-b border-white/10 pb-3">
                     {/* Placed Student's Name (Main Subject) */}
                     <h3 className="font-semibold text-base text-white truncate block mb-1" title={achievement.placedStudentName}>
                         {achievement.placedStudentName || 'Placement Achieved'}
                     </h3>
                     {/* Placed Student's Branch/Year (Optional) */}
                    {(achievement.placedStudentBranch || achievement.placedStudentYear) && (
                         <div className="flex items-center gap-1.5 text-purple-300 mt-1">
                            <GraduationCap size={14} strokeWidth={1.5} />
                            <span className="text-xs">{achievement.placedStudentBranch}{achievement.placedStudentBranch && achievement.placedStudentYear ? ' • ' : ''}{achievement.placedStudentYear}</span>
                         </div>
                    )}
                     {/* Posting Timestamp is moved to the footer */}
                </div>

                {/* Main Details Section */}
                <div className="space-y-4 flex-grow"> {/* flex-grow allows this section to expand */}

                    {/* Placement Details Block */}
                    {/* Groups Company, Role, Location, Salary */}
                    {(achievement.companyName || achievement.roleTitle || achievement.location || achievement.salary) && (
                        <div className="space-y-2 text-sm border border-white/10 bg-black/20 p-3 rounded-lg">
                            {/* Company */}
                            {achievement.companyName && (
                                <div className="flex items-center gap-2 min-w-0" title={achievement.companyName}>
                                    <Building2 className="text-purple-400 flex-shrink-0" size={15} strokeWidth={1.5}/>
                                    <span className="text-gray-100 truncate">{achievement.companyName}</span>
                                </div>
                            )}
                            {/* Role */}
                            {achievement.roleTitle && (
                                <div className="flex items-center gap-2 min-w-0" title={achievement.roleTitle}>
                                    <Briefcase className="text-purple-400 flex-shrink-0" size={15} strokeWidth={1.5}/>
                                    <span className="text-gray-100 truncate">{achievement.roleTitle}</span>
                                </div>
                            )}
                            {/* Location */}
                            {achievement.location && (
                                <div className="flex items-center gap-2 text-xs" title={achievement.location}>
                                    <MapPin size={14} strokeWidth={1.5} className="text-purple-400 flex-shrink-0"/>
                                    <span className="text-gray-200">{achievement.location}</span>
                                </div>
                             )}
                             {/* Salary */}
                             {achievement.salary && (
                                <div className="flex items-center gap-2 text-xs" title={`Package: ${achievement.salary}`}>
                                    <IndianRupee size={14} strokeWidth={1.5} className="text-green-400 flex-shrink-0"/>
                                    <span className="text-gray-100 font-medium">{achievement.salary}</span>
                                </div>
                             )}
                        </div>
                    )}

                    {/* Skills Section (if available) */}
                    {achievement.skills && achievement.skills.length > 0 && (
                         <div className="pt-1">
                            <h4 className="text-xs font-semibold text-purple-300 mb-1.5 uppercase tracking-wider">Skills</h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {achievement.skills.slice(0, 5).map((skill, index) => ( // Limit displayed skills
                                    <span key={index} className="px-2 py-0.5 bg-white/10 rounded text-purple-200 text-[11px]">
                                        {skill}
                                    </span>
                                ))}
                                {achievement.skills.length > 5 && <span className='text-[11px] text-gray-400'>...</span>}
                            </div>
                        </div>
                    )}

                    {/* Job Description (Optional & Condensed) */}
                    {achievement.jobDescription && (
                         <div className="pt-1">
                             {/* <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wider">Role Description</h4> */}
                             <p className="text-gray-300 text-xs italic line-clamp-2"> {/* Smaller text, limited lines */}
                                 {achievement.jobDescription}
                             </p>
                         </div>
                    )}

                     {/* Student's Main Text/Message (Experience/Advice) */}
                     {achievement.text && (
                         <p className="text-gray-200 text-sm pt-1 line-clamp-3"> {/* Slightly lighter, limited lines */}
                            {achievement.text}
                         </p>
                    )}

                    {/* Personal Message (Optional & Condensed) */}
                    {achievement.personalMessage && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                            {/* <div className="flex items-center gap-2 mb-1"> <MessageSquare className="text-purple-400 flex-shrink-0" size={14} strokeWidth={1.5}/> <span className="text-purple-300 font-medium text-xs">Personal Note</span> </div> */}
                            <p className="text-gray-300 text-xs italic line-clamp-2"> {/* Smaller, italic, limited */}
                                "{achievement.personalMessage}"
                            </p>
                        </div>
                    )}
                </div>

                 {/* Footer: Type Badge, Creator Info, Timestamp */}
                 <div className="mt-auto pt-3 border-t border-white/10 flex flex-wrap justify-between items-center gap-y-1 gap-x-3">
                    {/* Placement Type Badge */}
                    {achievement.placementType ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded border text-[11px] font-medium ${typeBadgeClass}`}>
                            {achievement.placementType}
                        </span>
                    ) : <div/> /* Spacer to push creator info right */}

                    {/* Creator Info & Timestamp */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400" title={`Posted by ${achievement.creatorName} ${postTimestamp}`}>
                        <span className='hidden sm:inline'>Posted by</span> {/* Hide on very small screens */}
                        {/* Link to creator's profile */}
                        <Link href={creatorProfileUrl} legacyBehavior>
                            {/* Stop propagation to prevent card link navigation when clicking creator */}
                            <a onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-purple-300 transition-colors">
                                <img
                                    src={achievement.creatorPhotoURL || '/default-avatar.png'}
                                    alt={`${achievement.creatorName}'s avatar`}
                                    onError={handleAvatarError}
                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                    loading="lazy"
                                />
                                <span className="hover:underline">{achievement.creatorName}</span>
                            </a>
                        </Link>
                        <span>•</span>
                        <span>{postTimestamp}</span>
                    </div>
                </div>
            </a>
        </Link> // End main clickable link
    );
};

export default PlacedStudentPost;