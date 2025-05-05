// app/api/placement/achievements/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin'; // Adjust path if needed
import { Timestamp, FieldValue, Query } from 'firebase-admin/firestore';
// Import StudentAchievement and PlacementType types (ensure path is correct)
import { StudentAchievement, PlacementType } from '@/lib/types/placement';

// --- Helper Function to Convert Timestamps ---
// Converts Firestore Timestamp objects within the data to ISO strings for JSON compatibility.
const convertTimestamps = (data: Record<string, any>): Record<string, any> => {
    const converted: Record<string, any> = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            try {
                converted[key] = value.toDate().toISOString();
            } catch (e) {
                 console.error(`Error converting timestamp for key ${key}:`, e);
                 converted[key] = null; // Use null for invalid timestamps
            }
        } else {
            converted[key] = value; // Keep other types (string, array, number, boolean, null) as is
        }
    }
    return converted;
};


// --- GET Handler: List Student Achievements ---
// Fetches a list of achievements, sorted by creation date descending.
export async function GET(request: NextRequest) {
    console.log('--- GET /api/placement/achievements ---'); // Log API call
    try {
        // Ensure Firestore service is available
        if (!firestore) {
            console.error("GET /api/placement/achievements Error: Firestore service is not available.");
            throw new Error("Firestore not initialized.");
        }

        // Extract query parameters (e.g., for pagination later)
        const { searchParams } = request.nextUrl;
        // --- Use 'view' param for potential future filtering ---
        const view = searchParams.get('view') || 'all'; // 'all', 'myAchievements'
        const limitParam = parseInt(searchParams.get('limit') || '50', 10); // Set a reasonable default limit

        console.log(`API GET /api/placement/achievements - Params: view=${view}, limit=${limitParam}`);

        // Get reference to the 'studentAchievements' collection
        const achievementsCollectionRef = firestore.collection('studentAchievements');
        // Start building the query
        let queryRef: Query = achievementsCollectionRef; // Use Firestore Query type

        // --- Apply 'My Achievements' Filter based on AUTHENTICATED user ---
        if (view === 'myAchievements') {
            const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
            if (!idToken) {
                 console.warn("Unauthorized access attempt for 'myAchievements' view (no token)");
                 return NextResponse.json({ error: "Unauthorized: Authentication required to view your achievements" }, { status: 401 });
            }
            let uid;
            try {
                const decodedToken = await adminAuth.verifyIdToken(idToken);
                uid = decodedToken.uid;
                // Apply the filter based on the authenticated user's UID (using creatorId field)
                queryRef = queryRef.where('creatorId', '==', uid);
                 console.log(`Filtering achievements for authenticated user (view: ${view}): ${uid}`);
            } catch (authError: any) {
                console.error("❌ Auth error verifying token for 'myAchievements' view:", authError.code, authError.message);
                return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
            }
        } else if (view === 'all') {
            // No filter needed for 'all' view
             console.log(`Fetching all achievements (view: ${view}).`);
        } else {
            // Handle other views if they are meant to be handled server-side
             console.warn(`GET /api/placement/achievements: Unhandled view parameter: ${view}`);
             // Optionally return 400 or just proceed with 'all' logic
        }


        // Apply Sorting (Newest first for a feed) and Limit
        queryRef = queryRef.orderBy('createdAt', 'desc').limit(limitParam);

        // Execute the query
        const querySnapshot = await queryRef.get();

        // Map the retrieved documents to the StudentAchievement type
        const achievements = querySnapshot.docs.map(doc => {
            const data = doc.data(); // Get raw data

            // Ensure data exists before processing
            if (!data) {
                console.warn(`Document ${doc.id} in studentAchievements has no data. Skipping.`);
                return null; // Skip this document
            }

            // Convert any Firestore Timestamps in the data to ISO strings
            const achievementDataWithDates = convertTimestamps(data);

            // Construct the StudentAchievement object, providing defaults for all fields
            // Ensure this matches the structure defined in lib/types/placement.ts (with creatorId, placedStudentName etc.)
            const achievement: StudentAchievement = {
                id: doc.id, // Add document ID
                creatorId: achievementDataWithDates.creatorId ?? '',
                creatorName: achievementDataWithDates.creatorName ?? 'Unknown Poster',
                creatorPhotoURL: achievementDataWithDates.creatorPhotoURL ?? '/default-avatar.png',
                placedStudentName: achievementDataWithDates.placedStudentName ?? 'Unknown Student', // Required field from form
                placedStudentBranch: achievementDataWithDates.placedStudentBranch ?? '',
                placedStudentYear: achievementDataWithDates.placedStudentYear ?? '',
                placedStudentPhotoURL: achievementDataWithDates.placedStudentPhotoURL ?? '', // Optional photo
                companyName: achievementDataWithDates.companyName ?? 'Unknown Company',
                companyLogoURL: achievementDataWithDates.companyLogoURL ?? '',
                roleTitle: achievementDataWithDates.roleTitle ?? '',
                placementType: achievementDataWithDates.placementType, // Keep original or undefined
                text: achievementDataWithDates.text ?? '', // Main message/experience
                skills: Array.isArray(achievementDataWithDates.skills) ? achievementDataWithDates.skills : [],
                location: achievementDataWithDates.location ?? '',
                salary: achievementDataWithDates.salary ?? '',
                jobDescription: achievementDataWithDates.jobDescription ?? '',
                personalMessage: achievementDataWithDates.personalMessage ?? '',
                // Use converted dates, with robust fallbacks
                createdAt: achievementDataWithDates.createdAt ?? new Date(0).toISOString(),
                updatedAt: achievementDataWithDates.updatedAt ?? achievementDataWithDates.createdAt ?? new Date(0).toISOString(),
            };
            return achievement;
        })
        // Filter out any null results from the map (if a doc had no data)
        .filter((achievement): achievement is StudentAchievement => achievement !== null);

        console.log(`API GET /api/placement/achievements: Found ${achievements.length} valid achievements.`);
        // Return achievements array wrapped in an object for consistency
        return NextResponse.json({ achievements });

    } catch (error: any) {
        console.error("❌ GET /api/placement/achievements Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error fetching achievements.";
        // Return a standardized error response
        return NextResponse.json({ error: "Failed to fetch student achievements", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create Student Achievement Post ---
// Allows an authenticated user to post an achievement (potentially about someone else).
export async function POST(request: NextRequest) {
    console.log('--- POST /api/placement/achievements ---'); // Log API call
    try {
        // Ensure Firestore and Auth services are available
        if (!firestore || !adminAuth) {
            console.error("POST /api/placement/achievements Error: Firestore or Admin Auth service is not available.");
            throw new Error("Firestore or Admin Auth not initialized.");
        }

        // 1. Verify User Authentication via Authorization header (Identifies the CREATOR)
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
            console.warn("POST /api/placement/achievements: Unauthorized - No token provided.");
            return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
        }

        let decodedToken;
        try {
            // Verify the ID token using Firebase Admin SDK
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
            console.error("❌ POST /api/placement/achievements: Token verification failed:", authError.code, authError.message);
            const detail = authError.code === 'auth/id-token-expired' ? 'Token expired.' : authError.message;
            return NextResponse.json({ error: "Unauthorized: Invalid token", details: detail }, { status: 403 });
        }
        const creatorUid = decodedToken.uid; // UID of the user submitting the form
        console.log(`User ${creatorUid} attempting POST /api/placement/achievements.`);

        // 2. Get Creator Info from Verified Token
        const creatorName = decodedToken.name || "Anonymous Poster"; // Use name from token
        const creatorPhotoURL = decodedToken.picture || "/default-avatar.png"; // Use photo from token

        // 3. Parse JSON Request Body
        const body = await request.json();
        console.log("Received POST body:", JSON.stringify(body, null, 2));

        // 4. Server-side Validation (Check fields received from the form)
        // Required fields based on the updated requirements
        if (!body.placedStudentName?.trim() || !body.companyName?.trim() || !body.text?.trim()) { // Trim check
             console.warn("POST /api/placement/achievements: Validation failed - Missing required fields.");
             return NextResponse.json({ error: "Missing required fields (Placed Student Name, Company Name, Message/Experience)" }, { status: 400 });
        }
        // Optional: Add more specific validation
        if (body.skills && !Array.isArray(body.skills)) {
             return NextResponse.json({ error: "Invalid format: 'skills' must be an array." }, { status: 400 });
        }
        // Validate placementType only if it exists and is not empty
         if (body.placementType && body.placementType !== '' && !['Full-time', 'Internship', 'PPO', 'Other'].includes(body.placementType)) {
              return NextResponse.json({ error: "Invalid placementType value provided." }, { status: 400 });
         }

        // 5. Construct New Achievement Data object for Firestore
        // Initialize with required fields and defaults from token/body
        // Use Partial<StudentAchievement> initially to easily handle optional fields
        const newAchievementBaseData: Partial<StudentAchievement> = {
            // --- Creator Info ---
            creatorId: creatorUid,
            creatorName: creatorName,
            creatorPhotoURL: creatorPhotoURL,
            // --- Placed Student Info (From Form Body) ---
            placedStudentName: body.placedStudentName.trim(), // Required
            placedStudentBranch: body.placedStudentBranch?.trim() || '',
            placedStudentYear: body.placedStudentYear?.trim() || '',
            placedStudentPhotoURL: body.placedStudentPhotoURL?.trim() || '',
            // --- Placement Details (From Form Body) ---
            companyName: body.companyName.trim(), // Required
            companyLogoURL: body.companyLogoURL?.trim() || '',
            roleTitle: body.roleTitle?.trim() || '',
            // placementType: is set conditionally below
            location: body.location?.trim() || '',
            salary: body.salary?.trim() || '',
            jobDescription: body.jobDescription?.trim() || '',
            skills: Array.isArray(body.skills) ? body.skills.map(String).filter(Boolean) : [],
            text: body.text.trim(), // Required
            personalMessage: body.personalMessage?.trim() || '',
        };

        // --- Conditionally add placementType if it exists and is valid ---
        // This ensures 'undefined' is not added to the object sent to Firestore
        if (body.placementType && ['Full-time', 'Internship', 'PPO', 'Other'].includes(body.placementType)) {
            newAchievementBaseData.placementType = body.placementType as PlacementType;
        }
        // Note: If placementType is an empty string, null, undefined, or an invalid value from the body,
        // it simply won't be included in the `newAchievementBaseData` object being saved.

        console.log("Data prepared for Firestore:", JSON.stringify(newAchievementBaseData, null, 2));

        // 6. Add Document to Firestore in the 'studentAchievements' collection
        const achievementsCollectionRef = firestore.collection('studentAchievements');
        // The object passed to add() now only contains fields with defined values
        const docRef = await achievementsCollectionRef.add({ // Line ~196 (may shift)
            ...newAchievementBaseData, // Spread the conditionally built data object
            createdAt: FieldValue.serverTimestamp(), // Use Firestore server timestamp
            updatedAt: FieldValue.serverTimestamp(), // Set updatedAt same as createdAt initially
        });
        console.log(`API POST /api/placement/achievements: Achievement created ID: ${docRef.id} by creator ${creatorUid}`);

        // 7. Return Success Response
        return NextResponse.json(
            { message: "Achievement posted successfully", achievementId: docRef.id },
            { status: 201 } // HTTP 201 Created status
        );

    } catch (error: any) {
        console.error("❌ POST /api/placement/achievements Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An internal server error occurred.";
        // Log stack trace for easier debugging on the server
        if (error instanceof Error && error.stack) { console.error("Stack Trace:", error.stack); }
        // Return a standardized error response
        return NextResponse.json( { error: "Failed to post achievement", details: errorMessage }, { status: 500 });
    }
}