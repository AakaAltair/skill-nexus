// components/PlacementDetailView.tsx
"use client";

import React from 'react';
// Import necessary types
import { PlacementDrive, PlacementUpdate } from '@/lib/types/placement'; // Adjust path if needed
import { User } from 'firebase/auth'; // Import User type
import PlacementDriveBanner from './PlacementDriveBanner'; // Import the specific banner component
import PlacementAnnouncementsStream from './PlacementAnnouncementsStream'; // Import the stream component for updates
import ReactMarkdown from 'react-markdown'; // For rendering description potentially with markdown
import remarkGfm from 'remark-gfm'; // GitHub Flavored Markdown plugin for tables, etc.

// --- Props Interface ---
// Defines the properties expected by this component
interface PlacementDetailViewProps {
  drive: PlacementDrive | null; // The selected drive object (can be null if error/not found)
  onBack: () => void; // Function provided by parent to navigate back to the list view (used by banner now, but good practice to keep available)
  isOwner: boolean; // Is the current logged-in user the owner/poster of this drive?
  onDeleteRequest: () => void; // Function provided by parent to trigger the delete confirmation modal
  initialUpdates: PlacementUpdate[]; // Array of updates/announcements fetched by the parent page
  currentUser: User | null; // Current user object (needed for the announcements stream to allow posting)
  onToggleChat: () => void; // Function provided by parent to toggle the chat sidebar visibility
  // Optional: Pass chat state if UI elements here depend on it (e.g., changing Q&A button text)
  // isChatOpen?: boolean;
}

// --- Placement Drive Detail View Component ---
// This component renders the detailed information for a single selected placement drive.
const PlacementDetailView: React.FC<PlacementDetailViewProps> = ({
    drive,
    onBack, // Handler to return to the list view
    isOwner,
    onDeleteRequest, // Handler to initiate delete process
    initialUpdates,  // Updates data passed from parent
    currentUser,     // Current user passed from parent
    onToggleChat     // Handler to toggle the chat sidebar
    // isChatOpen // Optional: if needed for UI changes
}) => {

    // --- Render Loading or Not Found State ---
    // If the drive data is null (likely due to error or not yet loaded in parent),
    // display a fallback message. The parent component handles the primary loading indicator.
    if (!drive) {
        return (
            <div className="p-6 text-center text-gray-500 italic">
                Select a placement drive from the list to view its details.
            </div>
        );
    }

    // --- Helper Function to Format Dates Clearly for Detail View ---
    // Provides a more readable format (e.g., January 15, 2025)
    const formatDetailDate = (dateInput: string | Date | undefined | null): string => {
         if (!dateInput) return 'Not specified'; // Handle null or undefined input
         try {
             const date = dateInput instanceof Date ? dateInput : new Date(dateInput.toString());
             if (isNaN(date.getTime())) { return 'Invalid Date'; } // Check validity
             // Format to 'Month Day, Year'
             return date.toLocaleDateString('en-US', {
                 year: 'numeric', month: 'long', day: 'numeric',
             });
         } catch (e) {
            console.error("Error formatting date in Detail View:", e);
            return 'Invalid Date';
        }
    };

    return (
      // Main container for the detail view content with vertical spacing between sections
      <div className="space-y-6 md:space-y-8">

            {/* --- Placement Drive Banner --- */}
            {/* Renders the themed banner component at the top */}
            {/* Passes down drive data, ownership status, and action handlers */}
            <PlacementDriveBanner
                drive={drive}
                isOwner={isOwner}
                onDeleteRequest={onDeleteRequest}
                onToggleChat={onToggleChat} // Pass the chat toggle handler
                // isChatOpen={isChatOpen} // Pass if banner button needs to change based on state
            />

            {/* --- Main Content Sections Container --- */}
            {/* Card containing detailed information like description, eligibility, dates, etc. */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200/80 space-y-6">

                {/* Description Section */}
                {drive.description && (
                    <section aria-labelledby={`drive-description-${drive.id}`}>
                        <h2 id={`drive-description-${drive.id}`} className="text-lg font-semibold text-gray-800 mb-2 border-b pb-1">Description</h2>
                        {/* Use ReactMarkdown to render description, allowing basic formatting */}
                        {/* Apply prose styles for readability */}
                        <article className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-800 prose-headings:font-semibold prose-a:text-blue-600 hover:prose-a:underline">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {drive.description}
                            </ReactMarkdown>
                        </article>
                    </section>
                )}

                {/* Key Details Section */}
                {/* Displays Eligibility, Branches, Package, Location, Contact in a grid */}
                <section aria-labelledby={`drive-details-${drive.id}`} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-5 border-t border-gray-100">
                     <h2 id={`drive-details-${drive.id}`} className="sr-only">Key Drive Details</h2> {/* Hidden heading */}

                     {/* Eligibility Criteria */}
                     {drive.eligibilityCriteria && (
                        <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Eligibility</h3>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{drive.eligibilityCriteria}</p>
                        </div>
                     )}
                     {/* Eligible Branches */}
                     {drive.eligibleBranches && drive.eligibleBranches.length > 0 && (
                         <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Eligible Branches</h3>
                            <p className="text-sm text-gray-800">{drive.eligibleBranches.join(', ')}</p>
                        </div>
                     )}
                     {/* Package Details */}
                     {drive.packageDetails && (
                         <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Package Details</h3>
                            <p className="text-sm text-gray-800">{drive.packageDetails}</p>
                        </div>
                     )}
                     {/* Location */}
                     {drive.location && (
                         <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location(s)</h3>
                            <p className="text-sm text-gray-800">{drive.location}</p>
                        </div>
                     )}
                     {/* Contact Person */}
                     {drive.contactPerson && (
                         <div className="space-y-1">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</h3>
                            <p className="text-sm text-gray-800">{drive.contactPerson}</p>
                        </div>
                     )}
                </section>

                {/* Key Dates Section */}
                {/* Render only if there are any dates specified */}
                {drive.keyDates && Object.values(drive.keyDates).some(Boolean) && (
                     <section aria-labelledby={`drive-dates-${drive.id}`} className="pt-5 border-t border-gray-100">
                         <h2 id={`drive-dates-${drive.id}`} className="text-lg font-semibold text-gray-800 mb-2">Important Dates</h2>
                         <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-800 pl-1">
                            {/* Conditionally render each date */}
                            {drive.keyDates.applicationDeadline && <li><strong>Application Deadline:</strong> {formatDetailDate(drive.keyDates.applicationDeadline)}</li>}
                            {drive.keyDates.testDate && <li><strong>Test Date:</strong> {formatDetailDate(drive.keyDates.testDate)}</li>}
                            {drive.keyDates.interviewDate && <li><strong>Interview Date(s):</strong> {formatDetailDate(drive.keyDates.interviewDate)}</li>}
                            {drive.keyDates.startDate && <li><strong>Start Date:</strong> {formatDetailDate(drive.keyDates.startDate)}</li>}
                            {/* Add other key dates from your model here */}
                         </ul>
                     </section>
                 )}

                 {/* Application Section */}
                 {/* Render only if link or instructions exist */}
                 {(drive.applicationLink || drive.applicationInstructions) && (
                     <section aria-labelledby={`drive-apply-${drive.id}`} className="pt-5 border-t border-gray-100">
                        <h2 id={`drive-apply-${drive.id}`} className="text-lg font-semibold text-gray-800 mb-3">Application Process</h2>
                        {/* Application Instructions */}
                        {drive.applicationInstructions && (
                            <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">{drive.applicationInstructions}</p>
                        )}
                         {/* Apply Now Button (if link exists) */}
                         {drive.applicationLink && (
                            <div>
                                <a
                                    href={drive.applicationLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Apply Now
                                    {/* External Link Icon */}
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" /></svg>
                                </a>
                            </div>
                         )}
                     </section>
                 )}

            </div> {/* End Main Content Card */}

            {/* --- Announcements/Updates Stream Section --- */}
            {/* Render the stream component below the main details */}
            {/* Pass down necessary props including fetched updates */}
            <PlacementAnnouncementsStream
                driveId={drive.id!} // Pass non-null drive ID
                isOwner={isOwner}
                initialUpdates={initialUpdates} // Pass the updates data
                currentUser={currentUser} // Pass the current user
            />

      </div> // End Detail View container
    );
};

export default PlacementDetailView;