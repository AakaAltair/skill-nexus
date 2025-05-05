// components/EditSummaryForm.tsx
"use client";

import { useState, FormEvent } from 'react';
import { User, getIdToken } from 'firebase/auth'; // Assuming you pass currentUser
import { Loader2 } from 'lucide-react';

interface EditSummaryFormProps {
    currentUser: User | null; // Needed for auth token
    initialSummary: string | null | undefined; // The current summary text
    onSuccess: () => void; // Callback function after successful save
    onCancel: () => void; // Callback function to cancel/close
}

const EditSummaryForm: React.FC<EditSummaryFormProps> = ({
    currentUser,
    initialSummary,
    onSuccess,
    onCancel
}) => {
    // State for the summary text, initialized with the current value
    const [summary, setSummary] = useState(initialSummary || '');
    // State for loading indicator during submission
    const [isSubmitting, setIsSubmitting] = useState(false);
    // State for displaying submission errors
    const [error, setError] = useState<string | null>(null);

    // Handle form submission
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); // Prevent default browser form submission

        // Basic validation
        if (!currentUser) {
            setError("Authentication error. Please try logging in again.");
            return;
        }

        // Check if the summary text has actually changed
        const currentTrimmed = summary.trim();
        const initialTrimmed = initialSummary?.trim() || '';
        if (currentTrimmed === initialTrimmed) {
            console.log("No changes detected in summary.");
            onSuccess(); // Close modal as no actual update is needed
            return;
        }

        // Start submission process
        setIsSubmitting(true);
        setError(null);

        try {
            // Get the Firebase auth token
            const token = await getIdToken(currentUser);

            // Send PATCH request to the profile API endpoint
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // Include auth token
                },
                // Send *only* the 'summary' field in the body
                body: JSON.stringify({ summary: currentTrimmed }),
            });

            // Check if the API request was successful
            if (!response.ok) {
                // Try to parse error message from response, provide fallback
                const errorData = await response.json().catch(() => ({ message: "An unknown error occurred saving summary." }));
                throw new Error(errorData.message || `Failed to update summary (${response.status})`);
            }

            console.log("Summary updated successfully via API.");
            onSuccess(); // Call the success callback provided by the parent (closes modal, triggers refetch)

        } catch (err) {
            console.error("Error updating summary:", err);
            setError((err as Error).message);
            setIsSubmitting(false); // Re-enable form on error
        }
        // No finally block needed for setIsSubmitting(false) because onSuccess closes the modal
    };

    return (
        // Form element with padding and spacing for its children
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white rounded-b-lg"> {/* Added padding */}
            {/* Form Title */}
            <h3 className="text-lg font-semibold text-black mb-4" id="modal-title">Edit Summary</h3>

            {/* Textarea for Summary */}
            <div>
                {/* Screen reader label */}
                <label htmlFor="summary-textarea" className="sr-only">Summary</label>
                <textarea
                    id="summary-textarea"
                    rows={8} // Adjust rows as needed
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Write a brief professional summary highlighting your skills, experience, and goals..."
                    // Styling: Tailwind utilities for appearance, border, padding, focus ring (using Accent 1)
                    className="w-full rounded-md border border-gray-300 shadow-sm p-3 focus:border-[#0070F3] focus:ring-1 focus:ring-[#0070F3] text-black text-base placeholder-gray-400"
                />
            </div>

            {/* Display Error Message */}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            {/* Form Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                {/* Cancel Button: Neutral styling */}
                <button
                    type="button" // Important: Prevent default form submission
                    onClick={onCancel}
                    disabled={isSubmitting} // Disable while submitting
                    // Styling: White background, gray border, black text, gray hover/focus
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-400 disabled:opacity-50 transition-colors"
                >
                    Cancel
                </button>
                {/* Save Button: Primary action styling */}
                <button
                    type="submit"
                    disabled={isSubmitting} // Disable while submitting
                    // Styling: Accent 1 background, white text, hover effect, focus ring
                    className="flex justify-center items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0070F3] hover:bg-[#005bb5] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0070F3] transition-colors w-28" // Fixed width for consistency
                >
                    {/* Show loader when submitting */}
                    {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Save'}
                </button>
            </div>
        </form>
    );
};

export default EditSummaryForm;