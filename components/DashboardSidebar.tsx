// components/DashboardSidebar.tsx
"use client";

import Link from 'next/link'; // Or use simple <a> for hash links

interface SidebarLink {
    id: string; // Corresponds to the section ID (e.g., 'summary', 'experience')
    title: string; // Text to display (e.g., 'Summary', 'Experience')
}

interface DashboardSidebarProps {
    sections: SidebarLink[];
    activeSectionId: string | null; // ID of the currently active section
    className?: string; // Allow passing custom classes
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
    sections,
    activeSectionId,
    className = ""
}) => {

    const baseLinkStyle = "block px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out";
    const inactiveLinkStyle = "text-gray-600 hover:bg-gray-100 hover:text-black";
    // Use Accent 1 for active state background/text or a border
    const activeLinkStyle = "bg-blue-50 text-[#0070F3] font-semibold"; // Example: Light blue bg, Accent 1 text

    return (
        <nav className={`space-y-1 ${className}`} aria-label="Dashboard Navigation">
            {sections.map((section) => (
                <a // Using simple <a> for hash links is often easier than <Link>
                    key={section.id}
                    href={`#${section.id}`} // Link to the section ID
                    className={`${baseLinkStyle} ${
                        activeSectionId === section.id ? activeLinkStyle : inactiveLinkStyle
                    }`}
                    // Indicate current section for accessibility
                    aria-current={activeSectionId === section.id ? 'page' : undefined}
                >
                    {section.title}
                </a>
            ))}
        </nav>
    );
};

export default DashboardSidebar;