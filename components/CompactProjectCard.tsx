// components/CompactProjectCard.tsx
"use client";

import { Project, ProjectStatus, ProjectType } from '@/lib/types/project'; // Adjust path if needed
import Link from 'next/link'; // Use next/link
import { formatSimpleDate } from '@/lib/dateUtils'; // Adjust path if needed
import { Star, Clock } from 'lucide-react'; // Example icons
import { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking

interface CompactProjectCardProps {
    project: Project;
    // Add other props if needed, e.g., isFavorite
}

// Helper to get status color (adjust if needed)
const getStatusColor = (status?: ProjectStatus): string => {
    switch (status) {
        case 'In Progress': return 'text-blue-600 bg-blue-100';
        case 'Completed': return 'text-green-600 bg-green-100';
        case 'Planning': return 'text-yellow-600 bg-yellow-100';
        case 'Idea': return 'text-purple-600 bg-purple-100';
        case 'Paused': return 'text-gray-600 bg-gray-100';
        case 'Archived': return 'text-gray-500 bg-gray-100 opacity-70';
        default: return 'text-gray-500 bg-gray-100';
    }
};
// Helper to get type color/icon (simplified)
const getTypeInfo = (type?: ProjectType): { color: string; icon?: React.ReactNode } => {
    switch (type) {
        case 'College Course': return { color: 'border-cyan-300' };
        case 'Personal': return { color: 'border-lime-300' };
        case 'Competition': return { color: 'border-amber-300' };
        default: return { color: 'border-gray-300' };
    }
};

// Helper function to check if a date is valid
// (Move this to lib/dateUtils.ts later)
function isValidDate(date: string | Timestamp | Date | undefined | null): boolean {
    if (!date) return false;
    try {
        if (date instanceof Timestamp) { return typeof date.seconds === 'number' && !isNaN(date.seconds); }
        if (date instanceof Date) { return !isNaN(date.getTime()); }
        if (typeof date === 'string') { if (date === '' || date === 'Invalid Date') return false; return !isNaN(Date.parse(date)); }
    } catch { return false; }
    return false;
}


const CompactProjectCard: React.FC<CompactProjectCardProps> = ({ project }) => {
    if (!project || !project.id) {
        console.warn("CompactProjectCard received invalid project data:", project);
        return null; // Don't render if project or id is missing
    }

    const typeInfo = getTypeInfo(project.projectType);

    return (
        // --- CORRECTED Link component ---
        // Removed the inner <a> tag
        // Moved className and href directly to the Link component
        // Removed legacyBehavior prop (it's default false)
        <Link
            href={`/projects/${project.id}`}
            className={`block p-3 border rounded-md bg-white hover:shadow-md hover:border-gray-300 transition-all duration-150 ease-in-out h-full flex flex-col ${typeInfo.color} border-l-4`} // Classes moved here
        >
            <div className="flex-grow mb-1">
                <h4 className="font-semibold text-sm text-black leading-snug mb-1 line-clamp-2">{project.title || "Untitled Project"}</h4>
                 {/* Display Status */}
                 {project.status && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getStatusColor(project.status)}`}>
                        {project.status}
                    </span>
                )}
            </div>
            {/* Footer: Subtle Timestamp */}
            {isValidDate(project.updatedAt) && ( // Check validity before formatting
                 <div className="flex items-center text-xs text-gray-400 mt-auto pt-1">
                     <Clock size={12} className="mr-1"/> Last updated: {formatSimpleDate(project.updatedAt)}
                 </div>
            )}
             {/* Optional favorite star */}
             {/* {isFavorite && <Star size={14} className="absolute top-2 right-2 text-yellow-400 fill-current"/>} */}
        </Link>
        // --- End CORRECTED Link component ---
    );
};

export default CompactProjectCard;