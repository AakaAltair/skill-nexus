// components/PlacementFilters.tsx
"use client";

import React from 'react';
import { PlacementStatus } from '@/lib/types/placement'; // Adjust path if needed

// --- Define available status options ---
// Includes 'All' for the dropdown default/reset state
const statusOptions: Array<PlacementStatus | 'All'> = ['All', 'Upcoming', 'Ongoing', 'Past', 'Cancelled'];

// --- Define props interface ---
// Describes the data and event handlers this component receives from its parent page
interface PlacementFiltersProps {
    // General search term state and handler
    searchTerm: string;
    onSearchChange: (value: string) => void;

    // Status filter state and handler
    statusFilter: PlacementStatus | 'All';
    onStatusChange: (value: PlacementStatus | 'All') => void;

    // Company filter state and handler
    companyFilter: string;
    onCompanyChange: (value: string) => void;

    // Role filter state and handler
    roleFilter: string;
    onRoleChange: (value: string) => void;

    // Branch filter state and handler
    branchFilter: string;
    onBranchChange: (value: string) => void;

    // Add more filter props here if needed (e.g., role type dropdown)
    // roleTypeFilter: string;
    // onRoleTypeChange: (value: string) => void;
}

// --- Placement Filters Component ---
// Renders the filter bar UI elements
const PlacementFilters: React.FC<PlacementFiltersProps> = ({
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusChange,
    companyFilter,
    onCompanyChange,
    roleFilter,
    onRoleChange,
    branchFilter,
    onBranchChange,
    // Destructure other filter props here when added
}) => {

    // --- Styling Variables ---
    // Consistent styles for inputs and selects, matching the parent page's controls
    const selectStyle = "bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 w-full sm:w-auto h-9";
    const inputStyle = "bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm placeholder-gray-400 text-gray-900 outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 focus:border-blue-500 transition duration-150 w-full h-9";
    // Use consistent height for all filter inputs/selects
    const filterInputStyle = inputStyle;

    // --- Clear All Filters Handler ---
    // Resets all filter states by calling the parent handlers with default values
    const handleClearFilters = () => {
        onSearchChange('');
        onStatusChange('All');
        onCompanyChange('');
        onRoleChange('');
        onBranchChange('');
        // Reset other filters here when added
    };

    // Determine if any filter (other than default 'All' status) is active
    const isAnyFilterActive = searchTerm.trim() !== '' ||
                              statusFilter !== 'All' ||
                              companyFilter.trim() !== '' ||
                              roleFilter.trim() !== '' ||
                              branchFilter.trim() !== '';

    return (
        // Container for filter controls, uses flex-wrap for responsiveness
        <div className="flex flex-wrap gap-3 items-center mb-6">

            {/* General Search Input */}
            <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-64 lg:w-72">
                 <input
                    type="search"
                    placeholder="Search All Fields..." // General placeholder
                    value={searchTerm} // Controlled value
                    onChange={(e) => onSearchChange(e.target.value)} // Update parent state
                    className={inputStyle}
                    aria-label="Search placement drives"
                />
            </div>

            {/* Status Filter Dropdown */}
            <div className="w-full sm:w-auto">
                 <select
                    value={statusFilter} // Controlled value
                    onChange={(e) => onStatusChange(e.target.value as PlacementStatus | 'All')} // Update parent state
                    className={selectStyle}
                    aria-label="Filter by drive status"
                >
                     {/* Map over status options */}
                     {statusOptions.map(status => (
                        <option key={status} value={status}>
                            {status === 'All' ? 'All Statuses' : status}
                        </option>
                    ))}
                </select>
            </div>

            {/* Company Filter (Text Input) */}
            <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-40">
                 <input
                    type="text"
                    placeholder="Company..."
                    value={companyFilter} // Controlled value
                    onChange={(e) => onCompanyChange(e.target.value)} // Update parent state
                    className={filterInputStyle}
                    aria-label="Filter by company"
                />
            </div>

            {/* Role Filter (Text Input) */}
            <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-40">
                 <input
                    type="text"
                    placeholder="Role Title..."
                    value={roleFilter} // Controlled value
                    onChange={(e) => onRoleChange(e.target.value)} // Update parent state
                    className={filterInputStyle}
                    aria-label="Filter by role title"
                />
            </div>

             {/* Branch Filter (Text Input) */}
            <div className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-32">
                 <input
                    type="text"
                    placeholder="Branch..."
                    value={branchFilter} // Controlled value
                    onChange={(e) => onBranchChange(e.target.value)} // Update parent state
                    className={filterInputStyle}
                    aria-label="Filter by eligible branch"
                />
            </div>
            {/* Add more filter inputs/selects here as needed */}


             {/* Clear Filters Button - Appears only if any filter is active */}
             {isAnyFilterActive && (
                 <button
                     onClick={handleClearFilters}
                     className="text-xs text-gray-500 hover:text-red-600 ml-auto px-2 py-1 h-9 flex items-center" // Match height and align
                     aria-label="Clear all filters"
                     title="Clear all filters"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1"><path fillRule="evenodd" d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" clipRule="evenodd" /></svg>
                    Clear
                 </button>
             )}

        </div>
    );
};

export default PlacementFilters;