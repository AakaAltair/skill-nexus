// app/learning/join/page.tsx
"use client";

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

const MIN_HEIGHT_CONTENT = 'min-h-[calc(100vh-4rem-2rem)]';

const JoinLearningClassroomPage: React.FC = () => {
    // Get auth state from AuthContext.
    const { currentUser, isAuthLoading, isProfileLoading } = useAuth();
    const router = useRouter();

    // --- State ---
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- Auth Check ---
    // Wait for auth/profile loading to complete
    if (isAuthLoading || isProfileLoading) {
        return (
             <div className={`flex justify-center items-center pt-16 ${MIN_HEIGHT_CONTENT}`}>
                <LoadingSpinner />
             </div>
        );
    }

    // If not logged in, show unauthorized message
    if (!currentUser) {
        return (
             <div className={`container mx-auto px-4 py-8 mt-16 text-center ${MIN_HEIGHT_CONTENT}`}>
                 <h1 className="text-2xl font-bold text-red-700 mb-4">Unauthorized</h1>
                 <p className="text-gray-600 mb-4">You must be logged in to join a learning classroom.</p>
                 <Link href="/" className="text-blue-600 hover:underline">Go to home page (Login)</Link>
             </div>
        );
    }

    // If logged in, render the join form

    // --- Input Change Handler ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Automatically convert input to uppercase as join codes are generated in uppercase
        setJoinCode(e.target.value.trim().toUpperCase());
        setError(null); // Clear error on input change
    };

    // --- Form Submit Handler ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!joinCode || joinCode.length !== 7) { // Basic client-side validation for format
            setError('Please enter a valid 7-character join code.');
            return;
        }

        setIsJoining(true);
        setError(null);

        try {
            // Get the user's ID token for backend authentication
            const idToken = await currentUser.getIdToken(true);

            console.log(`Attempting to join with code: ${joinCode}`);

            // Send POST request to the backend API
            const response = await fetch('/api/learning-classrooms/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`, // Include auth token
                },
                body: JSON.stringify({ joinCode: joinCode }), // Send the join code in the body
            });

            if (!response.ok) {
                // Attempt to parse error message from API response
                const errorBody = await response.json().catch(() => ({}));
                // Use error message from API if available, otherwise a generic one
                const apiError = errorBody.message || `Failed to join classroom (${response.status})`;
                throw new Error(apiError);
            }

            const result = await response.json(); // Expect { message: ..., classroomId: ... }
            console.log("Successfully joined classroom:", result);

            // Redirect to the newly joined classroom's detail page
            router.push(`/learning/${result.classroomId}`);

        } catch (err: any) {
            console.error('❌ Error joining classroom:', err);
            // Display the error message from the API or a default one
            setError(err.message || 'Could not join classroom.');
        } finally {
            setIsJoining(false); // Stop joining state
        }
    };

    // --- Render Join Form ---
    return (
        <div className={`container mx-auto px-4 py-8 mt-16 max-w-md text-center ${MIN_HEIGHT_CONTENT}`}>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Join a Learning Classroom</h1>
            <p className="text-gray-600 mb-8">Enter the code provided by your teacher or administrator.</p>

            {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
                <div>
                    <label htmlFor="joinCode" className="sr-only">Join Code</label> {/* Accessible label, visually hidden */}
                    <input
                        type="text"
                        id="joinCode"
                        name="joinCode"
                        value={joinCode}
                        onChange={handleInputChange}
                        required // HTML5 validation
                        className="w-full px-4 py-3 text-xl text-center border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isJoining}
                        placeholder="Enter Code"
                         minLength={7} // HTML5 validation for length
                         maxLength={7}
                    />
                </div>

                {/* Action Button */}
                <button
                    type="submit"
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 text-lg font-medium flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isJoining || !joinCode || joinCode.length !== 7} // Disable if joining, code is empty, or length is wrong
                >
                    {isJoining ? (
                         // Loading spinner inside the button
                         <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     ) : null}
                    {isJoining ? 'Joining...' : 'Join Classroom'}
                </button>

                {/* Optional: Link back to list */}
                <div className="text-center mt-4">
                   <Link href="/learning" className="text-sm text-gray-600 hover:underline">Back to Learning Classrooms</Link>
                </div>
            </form>
        </div>
    );
};

export default JoinLearningClassroomPage;