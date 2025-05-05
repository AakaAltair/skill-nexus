// app/api/users/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
// Import your firebaseAdmin instances
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Adjust path as needed
// No need to import admin from 'firebase-admin' for this GET request

const PROFILE_COLLECTION = 'studentProfiles'; // The collection where user profiles are stored

// --- Helper Function to Authenticate User ---
// TODO: Move this to a shared utility file like lib/serverAuthUtils.ts
// It's duplicated here and in other route files (profile, projects, community), centralize it later.
async function authenticateUser(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Use NextResponse.json for consistent API responses
        return { user: null, error: 'Authentication required', status: 401 };
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        // Return user details from the token
        const user = {
            uid: decodedToken.uid,
            name: decodedToken.name,
            email: decodedToken.email,
            photoURL: decodedToken.picture,
         };
        return { user, error: null, status: 200 };
    } catch (error: unknown) {
        console.error('API Route: Error verifying ID token in /api/users/search:', error);
         const errorMessage = error instanceof Error ? error.message : 'Authentication failed.';
         if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'auth/id-token-expired') {
             return { user: null, error: 'Authentication token expired.', status: 401 };
         }
        return { user: null, error: 'Invalid authentication token.', status: 401 };
    }
}

// --- GET /api/users/search ---
// Authenticated endpoint to search users by name prefix in the 'studentProfiles' collection.
export async function GET(req: NextRequest) {
    console.log('--- GET /api/users/search ---');

    // 1. Authenticate the user - Searching the directory requires authentication
    const authResult = await authenticateUser(req);
    if (authResult.error || !authResult.user) {
         console.warn(`GET /api/users/search: Unauthorized attempt - ${authResult.error}`);
        return NextResponse.json({ message: authResult.error }, { status: authResult.status });
    }

    // 2. Get the search term from query parameters
    const searchTerm = req.nextUrl.searchParams.get('term');

    // 3. Basic validation for search term
    if (!searchTerm || searchTerm.trim() === '') {
        // Return an empty array if no term is provided, status 200
        console.log("GET /api/users/search: No search term provided.");
        return NextResponse.json({ users: [] }, { status: 200 });
    }

    const term = searchTerm.trim();

    // Optional: Add a minimum length check server-side too (matches frontend for consistency)
     if (term.length < 2) {
          console.log(`GET /api/users/search: Search term "${term}" too short.`);
         return NextResponse.json({ users: [] }, { status: 200 });
     }

    console.log(`GET /api/users/search: Searching for term: "${term}"`);

    try {
        // 4. Perform Firestore Query for Name Prefix Match
        // This query looks for documents where the 'name' field
        // starts with the provided 'term'.
        // !!! REQUIRES A FIRESTORE INDEX on 'name' (ascending) !!!
        // If you haven't already, you MUST create this index in your Firebase console.
        // Firestore logs will suggest it with a link (or you can create manually).
        const usersSnapshot = await firestore.collection(PROFILE_COLLECTION)
            .orderBy('name') // Order by the field you are filtering (name)
            .startAt(term)   // Start at documents where 'name' is >= term
            .endAt(term + '\uf8ff') // End at documents where 'name' starts with term. '\uf8ff' is a high-range unicode character.
            .limit(20) // Limit results to avoid large reads - adjust as needed
            .get();

        // 5. Format the results
        const users = usersSnapshot.docs.map(doc => {
            const data = doc.data();
            // Return only necessary public fields for the search results list display on the frontend.
            // Include the userId (document ID) so the frontend can link to the profile page.
            return {
                userId: doc.id, // Document ID is the user's UID - CRUCIAL for profile links
                name: data.name || 'Unnamed User', // Provide default name if missing
                photoURL: data.photoURL || null, // Include photoURL
                headline: data.headline || null, // Include headline
                // TODO: Include other fields you might want to show in the search result list card preview
                // e.g., college: data.college || null,
                // e.g., branch: data.branch || null,
            };
        });

        console.log(`API GET /api/users/search: Found ${users.length} users for term "${term}".`);

        // 6. Return the results as JSON
        // The frontend (app/users/page.tsx) expects an object like { users: [...] }
        return NextResponse.json({ users }, { status: 200 });

    } catch (error: unknown) {
        console.error("API Route: Error searching users:", error);
         const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
        // Check if it's a Firestore index error (Firestore might return 'failed-precondition')
        if (error instanceof Error && error.message.includes('index') || (error as any).code === 'failed-precondition') {
             console.warn('Firestore query requires an index for this search. Check logs/console for index creation link.');
             // Return a user-friendly message about the index if it's a common issue during development/setup
           return NextResponse.json({ message: 'Search requires a database index. Please contact support if this persists.', error: errorMessage }, { status: 500});
        }
        // Handle specific Firestore permission error if rules deny read access for others
         if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied') {
              console.warn(`GET /api/users/search: Permission denied searching profiles. Check Firestore Rules.`);
              // Your rules should allow authenticated reads for studentProfiles
             return NextResponse.json({ message: 'Permission denied to search users.' }, { status: 403 });
         }

        // Generic fallback for other errors
        return NextResponse.json({ message: 'Failed to search users', error: errorMessage }, { status: 500 });
    }
}