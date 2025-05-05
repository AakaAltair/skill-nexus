// app/api/profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Adjust path as needed
import admin from 'firebase-admin'; // Import admin namespace for Timestamp/FieldValue
// TODO: Import the StudentProfile type from '@/lib/types/profile' once created
// import { StudentProfile } from '@/lib/types/profile';

const PROFILE_COLLECTION = 'studentProfiles';

// --- Helper Function to Authenticate User ---
// TODO: Move this to a shared utility file like lib/serverAuthUtils.ts
async function authenticateUser(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null, error: 'Authentication required', status: 401 };
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        // Include relevant user details from token
        const user = {
            uid: decodedToken.uid,
            name: decodedToken.name,
            email: decodedToken.email,
            photoURL: decodedToken.picture,
         };
        return { user, error: null, status: 200 };
    } catch (error: unknown) {
        console.error('API Route: Error verifying ID token:', error);
         const errorMessage = error instanceof Error ? error.message : 'Authentication failed.';
         if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'auth/id-token-expired') {
             return { user: null, error: 'Authentication token expired.', status: 401 };
         }
        return { user: null, error: 'Invalid authentication token.', status: 401 };
    }
}

// --- GET /api/profile ---
// Fetch the profile for either a specified userId (via query param) OR the authenticated user.
// Requires authentication to prevent public access.
export async function GET(req: NextRequest) {
    // 1. Verify Authentication - Authentication is REQUIRED to access profiles
    const authResult = await authenticateUser(req);
    if (authResult.error || !authResult.user) {
        console.warn(`GET /api/profile: Unauthorized attempt - ${authResult.error}`);
        return NextResponse.json({ message: authResult.error }, { status: authResult.status });
    }
    const currentUserId = authResult.user.uid; // The ID of the user making the request

    // 2. Check for userId query parameter
    const targetUserId = req.nextUrl.searchParams.get('userId');

    // 3. Determine which profile userId to fetch:
    //    - If targetUserId is provided and valid, use it.
    //    - Otherwise, default to the authenticated user's ID.
    const userIdToFetch = targetUserId && typeof targetUserId === 'string' ? targetUserId : currentUserId;

    console.log(`API Route: GET profile for user ${userIdToFetch} (requested by ${currentUserId})`);


    try {
        // 4. Fetch the profile document using the determined userId
        const profileRef = firestore.collection(PROFILE_COLLECTION).doc(userIdToFetch);
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) {
            // --- Handle Profile Not Found ---
            // If a specific target userId was requested via query param and not found, return 404.
            // If the *authenticated* user's profile (default case) is not found, create a default.
            if (targetUserId && typeof targetUserId === 'string') {
                console.log(`API Route: Requested profile ${targetUserId} not found.`);
                 return NextResponse.json({ message: `Profile not found for user ID: ${targetUserId}` }, { status: 404 });
            } else {
                 console.log(`API Route: Authenticated user's profile ${userIdToFetch} not found, creating default.`);
                 // --- Create Default Profile If Not Found for the authenticated user ---
                 const defaultProfileData = {
                     userId: userIdToFetch, // This will be the currentUserId
                     name: authResult.user.name || 'New User',
                     photoURL: authResult.user.photoURL || null,
                     headline: null, summary: null, contactInfo: null, // Use null for empty objects/fields initially
                     education: [], experience: [], certifications: [], manualProjects: [],
                     skills: [], languages: [], awards: [], extracurriculars: [],
                     updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                     createdAt: admin.firestore.FieldValue.serverTimestamp()
                 };
                 await profileRef.set(defaultProfileData);
                 console.log(`API Route: Default profile created for user ${userIdToFetch}.`);
                 // Return the newly created profile (convert timestamps for client-side compatibility if needed)
                 return NextResponse.json({ profile: { ...defaultProfileData, userId: userIdToFetch, createdAt: new Date(), updatedAt: new Date() } }, { status: 200 }); // Convert TS for initial return
            }

        } else {
            // Profile exists, return its data
            const profileData = profileSnap.data();
             // Always include the userId explicitly for frontend convenience
            return NextResponse.json({ profile: { ...profileData, userId: userIdToFetch } }, { status: 200 });
        }

    } catch (error: unknown) {
        console.error(`API Route: Error fetching profile for user ${userIdToFetch}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
        // Handle specific Firestore permission error if rules deny read access for others
         if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied') {
              console.warn(`GET /api/profile: Permission denied fetching profile for user ${userIdToFetch}. Check Firestore Rules.`);
              // This should ideally not happen if rules allow authenticated reads, but good defense
             return NextResponse.json({ message: 'Permission denied to read profile.' }, { status: 403 });
         }
        // Generic server error
        return NextResponse.json({ message: 'Failed to fetch profile', error: errorMessage }, { status: 500 });
    }
}


// --- PATCH /api/profile ---
// This route updates the profile ONLY for the *authenticated* user.
export async function PATCH(req: NextRequest) {
    console.log('--- PATCH /api/profile ---');
    // Ensure user is authenticated to update their own profile
    const authResult = await authenticateUser(req);
    if (authResult.error || !authResult.user) {
        console.warn("PATCH /api/profile: Unauthorized attempt - ", authResult.error);
        return NextResponse.json({ message: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.user.uid; // Always use the authenticated user's ID for PATCH

    try {
        const profileRef = firestore.collection(PROFILE_COLLECTION).doc(userId); // Fetch the authenticated user's document
        // You could add a check here to ensure the document exists before attempting update,
        // although Firestore's update() method will fail if it doesn't exist, which is fine.
        // The GET handler should ensure a document exists for the authenticated user.

        const updates = await req.json();

        // --- Basic Server-Side Validation ---
        // ... (your existing validation logic) ...
         const arrayFields = ['education', 'experience', 'certifications', 'manualProjects', 'skills', 'languages', 'awards', 'extracurriculars'];
        for (const field of arrayFields) {
            if (updates.hasOwnProperty(field)) { // Only validate if field is present in the update
                 if (!Array.isArray(updates[field])) {
                    console.warn(`API Route: Validation failed for PATCH profile ${userId}: Field '${field}' is not an array.`);
                    return NextResponse.json({ message: `Invalid data format: '${field}' must be an array.` }, { status: 400 });
                 }
                 // TODO: Add deeper validation within array objects (e.g., required fields, date formats)
            }
        }
        if (updates.headline && typeof updates.headline === 'string' && updates.headline.length > 150) {
             return NextResponse.json({ message: 'Headline exceeds maximum length (150 characters)' }, { status: 400 });
        }
        if (updates.hasOwnProperty('contactInfo') && (typeof updates.contactInfo !== 'object' || updates.contactInfo === null)) {
             return NextResponse.json({ message: 'Invalid data format: \'contactInfo\' must be an object.' }, { status: 400 });
        }
        // --- End Validation ---


        // Prepare final updates, ensuring userId and createdAt are not changed and updatedAt is set
        const finalUpdates = {
            ...updates,
            // userId: userId, // No need to explicitly set userId here, as we're updating the doc identified by userId
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
        };

        // Prevent overwriting critical/immutable fields if accidentally sent by client
        delete finalUpdates.userId; // Explicitly disallow changing userId
        delete finalUpdates.createdAt; // Cannot change creation date via PATCH
        delete finalUpdates.id; // Should not be in patch payload

        console.log(`API Route: Updating profile for user ${userId} with keys:`, Object.keys(finalUpdates));

        // Use update() - this fails if the document doesn't exist.
        // This is the correct behavior for PATCH - you can't update a non-existent document.
        await profileRef.update(finalUpdates);

        console.log(`API PATCH /api/profile: Profile updated successfully for user ${userId}.`);
        return NextResponse.json({ message: 'Profile updated successfully' }, { status: 200 });

    } catch (error: unknown) {
        console.error(`API Route: Error updating profile for user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';

        // Handle specific Firestore errors
        if (typeof error === 'object' && error !== null && 'code' in error) {
            const firestoreError = error as { code: string; message: string };
             if (firestoreError.code === 'permission-denied') {
                 console.warn(`PATCH /api/profile: Permission denied for profile ${userId}. Check rules.`);
                 return NextResponse.json({ message: 'Permission denied to update profile.' }, { status: 403 });
             }
              if (firestoreError.code === 'not-found') {
                  console.warn(`PATCH /api/profile: Profile document not found for ${userId}.`);
                 return NextResponse.json({ message: 'Profile not found. Cannot update.' }, { status: 404 });
             }
            console.error(`API Route: Firestore error code: ${firestoreError.code}, message: ${firestoreError.message}`);
        }
        return NextResponse.json({ message: 'Failed to update profile', error: errorMessage }, { status: 500 });
    }
}