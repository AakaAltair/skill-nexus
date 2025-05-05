// components/LearningClassroomCard.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { LearningClassroom } from '@/lib/types/learning'; // Import the new type
// Assuming getProjectThemeStyles can generate themes based on *any* ID string
import { getProjectThemeStyles } from '@/lib/themeUtils'; // Adjust path if needed
// Assuming you have user-type icons or can use simple text
import { FiAward, FiUsers } from 'react-icons/fi'; // Using FiAward for teacher count, FiUsers for member count

// --- Define the props the component expects ---
interface LearningClassroomCardProps {
  classroom: LearningClassroom; // The classroom data object
  currentUserId: string | null; // Add prop for current user's UID
}

// --- Learning Classroom Card Component ---
const LearningClassroomCard: React.FC<LearningClassroomCardProps> = ({
    classroom,
    currentUserId, // Receive the UID
}) => {
    // --- Determine User's Relationship to this Classroom ---
    // Use optional chaining and type checks for robustness
    const isTeacherMember = currentUserId ? (Array.isArray(classroom.teacherIds) ? classroom.teacherIds.includes(currentUserId) : false) : false;
    const isStudentMember = currentUserId ? (Array.isArray(classroom.studentIds) ? classroom.studentIds.includes(currentUserId) : false) : false;
     // Check if the user is any type of member (should be true if the card is shown via API fetch)
     const isAnyMember = isTeacherMember || isStudentMember;


    // --- Get Theme Styles ---
    // Uses the classroom ID for theme consistency with other cards/banners
    // Provide a fallback ID if classroom or classroom.id is null
    const theme = useMemo(() => getProjectThemeStyles(classroom?.id || 'default-classroom'), [classroom?.id]);

    // --- Define internal link URL ---
    // Fallback to '#' if ID is missing (shouldn't happen with valid data from API)
    const classroomViewUrl = classroom?.id ? `/learning/${classroom.id}` : '#';

    // --- Combine Classroom Meta Tags for Display ---
    // Creates an array of key identifying details, use optional chaining
    const metaTags = [
        classroom?.academicYear,
        classroom?.year,
        classroom?.semester,
        classroom?.branch,
        classroom?.class,
        classroom?.division,
        classroom?.batch,
    ].filter(Boolean) as string[]; // Filter out any null, undefined, or empty strings

    // --- Determine the relationship badge text and styling ---
    let relationshipBadgeText: string | null = null;
    let relationshipBadgeClasses = "text-[10px] font-semibold px-2 py-0.5 rounded-full ";

    if (isTeacherMember && isStudentMember) {
        relationshipBadgeText = "Teacher & Student";
        relationshipBadgeClasses += "bg-purple-100 text-purple-800 border border-purple-300"; // Example color and border
    } else if (isTeacherMember) {
        relationshipBadgeText = "Teacher";
        relationshipBadgeClasses += "bg-blue-100 text-blue-800 border border-blue-300"; // Example color and border
    } else if (isStudentMember) {
        relationshipBadgeText = "Student";
        relationshipBadgeClasses += "bg-green-100 text-green-800 border border-green-300"; // Example color and border
    }
    // If neither, relationshipBadgeText remains null (card shouldn't be displayed if not a member)


    // --- Safely access classroom data for rendering ---
    // Use optional chaining '?.' in JSX where data might be missing initially,
    // although with the page loading logic, 'classroom' should be a valid object when rendered.
    // Added checks for teacherIds and studentIds being arrays before accessing length or includes.
    const teacherCount = Array.isArray(classroom?.teacherIds) ? classroom.teacherIds.length : 0;
    const studentCount = Array.isArray(classroom?.studentIds) ? classroom.studentIds.length : 0;
    // Total members (teachers + students)
    const totalMembers = teacherCount + studentCount;


    return (
        // Outer container:
        // - 'group' for hover effects.
        // - Transparent border initially, colored border on hover using theme.
        // - Add cursor-pointer to the main div as well for better hit area
        <div className={`relative bg-white border-2 border-transparent rounded-xl shadow-md hover:shadow-lg group-hover:${theme.hoverBorderClass} transition-all duration-300 flex flex-col h-full overflow-hidden`}>

            {/* Main Clickable Link wrapping most of the card content */}
            {/* Use the calculated URL, add block level display */}
            <Link href={classroomViewUrl} className="block flex flex-col flex-grow overflow-hidden">

                {/* Themed Background Area (Top part of the card) */}
                {/* Reuse the background style from the theme utility */}
                <div className={`h-28 sm:h-32 w-full overflow-hidden relative ${theme.backgroundClasses}`}>
                    {/* Position the relationship badge over the banner */}
                    {relationshipBadgeText && (
                        <span className={`absolute top-3 right-3 z-10 ${relationshipBadgeClasses}`}>
                            {relationshipBadgeText}
                        </span>
                    )}
                    {/* Subtle overlay gradient - uncomment if needed based on your theme */}
                    {/* <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-black/0"></div> */}
                </div>

                {/* Card Content Area */}
                 {/* p-4 pb-3 for consistent spacing, flex-grow to fill height */}
                 <div className="p-4 pb-3 flex flex-col flex-grow relative space-y-2">
                     {/* Main Content Below Themed Area */}
                     <div className="space-y-2.5"> {/* Consistent spacing */}
                        {/* Classroom Name (e.g., "2023-24 - 2nd Year - Sem 4...") */}
                        {/* Use optional chaining for safety */}
                        <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 transition-colors duration-200" title={classroom?.name || 'Untitled Classroom'}>
                            {classroom?.name || 'Untitled Classroom'}
                        </h2>

                        {/* Description */}
                        {/* Use optional chaining and provide a placeholder */}
                        <p className="text-xs text-gray-600 line-clamp-2 flex-grow min-h-[30px]">
                            {classroom?.description || <span className="italic opacity-70">No description provided.</span>}
                        </p>

                        {/* Classroom Meta Tags Section */}
                         {metaTags.length > 0 && (
                             <div className="pt-1 min-h-[24px]">
                                 <div className="flex flex-wrap gap-1.5 items-center">
                                     {/* Map and display key meta tags (use slice for limit) */}
                                     {metaTags.slice(0, 5).map((tag, index) => (
                                         <span
                                            key={`${tag}-${index}`} // Use index as fallback key if tag can be duplicate
                                            className="text-[10px] bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                                            title={tag}
                                        >
                                             {tag}
                                         </span>
                                     ))}
                                     {metaTags.length > 5 && (
                                         <span className="text-[10px] text-gray-400 whitespace-nowrap" title={`${metaTags.length - 5} more details`}>
                                             + {metaTags.length - 5} more
                                         </span>
                                     )}
                                 </div>
                             </div>
                         )}
                         {/* Fallback if no meta tags were provided */}
                         {metaTags.length === 0 && (
                              <div className="pt-1 min-h-[24px]">
                                  <span className="text-[10px] text-gray-400 italic">No details provided</span>
                              </div>
                         )}
                    </div>
                 </div>
                 {/* --- End Card Content Area --- */}

                 {/* --- Footer: Display Member Counts and Creation Date --- */}
                <div className="p-4 pt-2 mt-auto border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                     {/* Member Count (Teachers + Students) */}
                    {totalMembers > 0 && (
                         <div className="flex items-center" title={`${totalMembers} Member${totalMembers > 1 ? 's' : ''}`}>
                             {/* Members Icon */}
                              <FiUsers className="w-3.5 h-3.5 mr-1 opacity-60"/>
                             <span>{totalMembers}</span>
                         </div>
                    )}
                     {/* Creation Date - Push date to the right if member count exists, otherwise justify-end */}
                    {classroom?.createdAt && ( // Only show date if it exists
                        <div className={`flex items-center flex-shrink-0 whitespace-nowrap ${totalMembers > 0 ? '' : 'ml-auto'}`} title={`Created on: ${new Date(classroom.createdAt.toString()).toLocaleString()}`}>
                             {/* Calendar Icon */}
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1 opacity-60"><path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 .75.75V3h6.5V2.5a.75.75 0 0 1 1.5 0V3h.25A2.75 2.75 0 0 1 15.75 5.75v7.5A2.75 2.75 0 0 1 13 16H3A2.75 2.75 0 0 1 .25 13.25v-7.5A2.75 2.75 0 0 1 3 3h.25V2.5A.75.75 0 0 1 4 1.75ZM3.5 6a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Z" clipRule="evenodd" /></svg>
                              {/* Format date using simple date formatting */}
                              <span>{new Date(classroom.createdAt.toString()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                    )}
                </div>
                 {/* --- End Footer --- */}

            </Link> {/* --- End Main Clickable Link --- */}
        </div> // Close outer div
    );
};

export default LearningClassroomCard;