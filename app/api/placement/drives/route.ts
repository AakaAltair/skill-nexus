// app/api/placement/drive/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin'; // Adjust path if needed
import { Timestamp, FieldValue, Query } from 'firebase-admin/firestore'; // Import Query type
import { PlacementDrive, PlacementStatus } from '@/lib/types/placement'; // Adjust path if needed

// --- Helper Function to Convert Timestamps (Including nested keyDates) ---
// Converts Firestore Timestamp objects to ISO strings for JSON compatibility.
// Handles the nested 'keyDates' object specifically.
const convertTimestamps = (data: Record<string, any>): Record<string, any> => {
    const converted: Record<string, any> = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            // Convert top-level Timestamps
            converted[key] = value.toDate().toISOString();
        } else if (key === 'keyDates' && value && typeof value === 'object' && !Array.isArray(value)) {
            // Handle nested 'keyDates' object
             converted[key] = {};
             for(const dateKey in value) {
                 const dateValue = value[dateKey];
                 if (dateValue instanceof Timestamp) {
                     // Convert Timestamps within keyDates
                     converted[key][dateKey] = dateValue.toDate().toISOString();
                 } else {
                     // Keep non-Timestamp values (like strings if dates were already converted/stored as strings)
                     converted[key][dateKey] = dateValue;
                 }
             }
        } else {
            // Keep other data types (strings, numbers, booleans, arrays) as is
            converted[key] = value;
        }
    }
    return converted;
};


// --- GET Handler: List Placement Drives ---
// Handles fetching a list of placement drives, supports filtering by status and potentially userId.
export async function GET(request: NextRequest) {
    console.log('--- GET /api/placement/drive ---'); // Log endpoint entry
    try {
        // Ensure Firestore is initialized before proceeding
        if (!firestore) {
            console.error("GET /api/placement/drive Error: Firestore service is not available.");
            throw new Error("Firestore not initialized.");
        }

        // Extract query parameters from the request URL
        const { searchParams } = request.nextUrl;
        const statusFilter = searchParams.get('status'); // Filter by drive status (Upcoming, Ongoing, etc.)
        const userId = searchParams.get('userId');     // Filter by user ID (for 'My Drives' view, if implemented)
        const limitParam = parseInt(searchParams.get('limit') || '50', 10); // Limit results, default 50

        console.log(`API GET /api/placement/drive - Request Params: status=${statusFilter || 'All'}, userId=${userId || 'None'}, limit=${limitParam}`);

        // Get a reference to the 'placementDrives' collection
        const drivesCollectionRef = firestore.collection('placementDrives');
        // Start building the query
        let queryRef: Query = drivesCollectionRef; // Use Firestore Query type

        // Apply filters based on query parameters
        // Filter by Status
        if (statusFilter && ['Upcoming', 'Ongoing', 'Past', 'Cancelled'].includes(statusFilter)) {
            queryRef = queryRef.where('status', '==', statusFilter);
            console.log(`Applying filter for status: ${statusFilter}`);
        }
        // Filter by User ID (Poster)
        if (userId) {
            queryRef = queryRef.where('postedById', '==', userId); // Filter based on who posted the drive
            console.log(`Applying filter for postedById: ${userId}`);
        }

        // Apply Sorting (Default: Newest first) and Limit
        queryRef = queryRef.orderBy('createdAt', 'desc').limit(limitParam);

        // Execute the Firestore query
        const querySnapshot = await queryRef.get();

        // Map the retrieved documents to the PlacementDrive type
        const drives = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Convert any Firestore Timestamps in the data to ISO strings
            const driveDataWithConvertedDates = convertTimestamps(data);

            // Construct the PlacementDrive object with defaults for missing fields
            const drive: PlacementDrive = {
                id: doc.id, // Add document ID
                companyName: driveDataWithConvertedDates.companyName || 'Unknown Company',
                companyLogoURL: driveDataWithConvertedDates.companyLogoURL || '',
                roleTitle: driveDataWithConvertedDates.roleTitle || 'N/A',
                description: driveDataWithConvertedDates.description || '',
                eligibilityCriteria: driveDataWithConvertedDates.eligibilityCriteria || '',
                status: driveDataWithConvertedDates.status || 'Upcoming', // Default status if missing
                keyDates: driveDataWithConvertedDates.keyDates || {}, // Default to empty object
                packageDetails: driveDataWithConvertedDates.packageDetails || '',
                applicationLink: driveDataWithConvertedDates.applicationLink || '',
                applicationInstructions: driveDataWithConvertedDates.applicationInstructions || '',
                location: driveDataWithConvertedDates.location || '',
                eligibleBranches: Array.isArray(driveDataWithConvertedDates.eligibleBranches) ? driveDataWithConvertedDates.eligibleBranches : [],
                contactPerson: driveDataWithConvertedDates.contactPerson || '',
                commentsEnabled: driveDataWithConvertedDates.commentsEnabled !== false, // Default to true
                postedById: driveDataWithConvertedDates.postedById || '',
                postedByName: driveDataWithConvertedDates.postedByName || 'Admin', // Default poster name
                postedByPhotoURL: driveDataWithConvertedDates.postedByPhotoURL || '/default-avatar.png', // Default avatar
                createdAt: driveDataWithConvertedDates.createdAt || new Date(0).toISOString(), // Fallback creation date
                updatedAt: driveDataWithConvertedDates.updatedAt || driveDataWithConvertedDates.createdAt || new Date(0).toISOString(), // Fallback updated date
            };
            return drive;
        });

        console.log(`API GET /api/placement/drive: Found ${drives.length} drives (filter applied: ${statusFilter || 'All'}, ${userId ? 'userId='+userId : 'All Users'}).`);
        // Return the drives array wrapped in an object for consistency
        return NextResponse.json({ drives });

    } catch (error: any) {
        console.error("❌ GET /api/placement/drive Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error fetching placement drives.";
        // Return a standardized error response
        return NextResponse.json({ error: "Failed to fetch placement drives", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create Placement Drive ---
// Allows authorized users (checked via token/roles) to create a new placement drive document.
export async function POST(request: NextRequest) {
    console.log('--- POST /api/placement/drive ---'); // Log endpoint entry
    try {
        // Initial checks for Firebase Admin SDK services
        if (!firestore || !adminAuth) {
            console.error("POST /api/placement/drive Error: Firestore or Admin Auth service is not available.");
            throw new Error("Firestore or Admin Auth not initialized.");
        }

        // 1. Verify User Authentication via Authorization header
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
            console.warn("POST /api/placement/drive: Unauthorized - No token provided.");
            return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
        }

        let decodedToken;
        try {
            // Verify the ID token using Firebase Admin SDK
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
            console.error("❌ POST /api/placement/drive: Token verification failed:", authError.code, authError.message);
            const detail = authError.code === 'auth/id-token-expired' ? 'Token expired.' : authError.message;
            return NextResponse.json({ error: "Unauthorized: Invalid token", details: detail }, { status: 403 });
        }
        const uid = decodedToken.uid; // UID of the authenticated user posting the drive
        console.log(`User ${uid} attempting POST /api/placement/drive.`);

        // --- Authorization Check (Placeholder) ---
        // IMPORTANT: Implement your actual role/permission check here.
        // This should verify if the user (uid) has the necessary permissions
        // (e.g., 'admin', 'placement_coordinator') to create a drive.
        // const userIsAuthorized = await checkUserPermissionToCreateDrive(uid);
        const userIsAuthorized = true; // Replace with real check
        if (!userIsAuthorized) {
            console.warn(`User ${uid} is not authorized to create placement drives.`);
            return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
        }
        console.log(`User ${uid} authorized to create placement drive.`); // Log successful authorization

        // 2. Get Poster Info from Verified Token
        const posterName = decodedToken.name || "Placement Admin"; // Use name from token or default
        const posterPhotoURL = decodedToken.picture || "/default-avatar.png"; // Use picture from token or default

        // 3. Parse and Validate Request Body
        const body = await request.json();
        console.log("Received POST body:", JSON.stringify(body, null, 2));

        // Basic server-side validation for required fields
        if (!body.companyName || !body.roleTitle || !body.description || !body.status) {
             console.warn("POST /api/placement/drive: Validation failed - Missing required fields.");
             return NextResponse.json({ error: "Missing required fields (companyName, roleTitle, description, status)" }, { status: 400 });
        }
        // Validate status enum
        if (!['Upcoming', 'Ongoing', 'Past', 'Cancelled'].includes(body.status)) {
             console.warn(`POST /api/placement/drive: Validation failed - Invalid status: ${body.status}`);
             return NextResponse.json({ error: "Invalid status value provided." }, { status: 400 });
        }
        // Add more specific validation as needed (e.g., date formats in keyDates, URL formats)

        // 4. Construct New Placement Drive Data object for Firestore
        // Using Omit to exclude fields that will be generated (id, timestamps)
        const newDriveBaseData: Omit<PlacementDrive, 'id' | 'createdAt' | 'updatedAt'> = {
            companyName: body.companyName.trim(),
            companyLogoURL: body.companyLogoURL?.trim() || '', // Use empty string if null/undefined
            roleTitle: body.roleTitle.trim(),
            description: body.description.trim(),
            eligibilityCriteria: body.eligibilityCriteria?.trim() || '',
            status: body.status as PlacementStatus, // Assert type after validation
            keyDates: body.keyDates || {}, // Pass keyDates object, ensure it's handled correctly if dates are strings
            packageDetails: body.packageDetails?.trim() || '',
            applicationLink: body.applicationLink?.trim() || '',
            applicationInstructions: body.applicationInstructions?.trim() || '',
            location: body.location?.trim() || '',
            eligibleBranches: Array.isArray(body.eligibleBranches) ? body.eligibleBranches.map(String).filter(Boolean) : [], // Ensure array of strings
            contactPerson: body.contactPerson?.trim() || '',
            commentsEnabled: body.commentsEnabled !== false, // Default to true
            postedById: uid, // Set poster ID from authenticated user
            postedByName: posterName, // Set poster name from token/profile
            postedByPhotoURL: posterPhotoURL, // Set poster photo from token/profile
        };
        console.log("Data prepared for Firestore:", JSON.stringify(newDriveBaseData, null, 2));

        // 5. Add Document to Firestore with Server Timestamps
        const drivesCollectionRef = firestore.collection('placementDrives'); // Correct collection name
        // Use the Admin SDK to add the document, automatically generating an ID
        const docRef = await drivesCollectionRef.add({
            ...newDriveBaseData,
            createdAt: FieldValue.serverTimestamp(), // Let Firestore set the creation timestamp
            updatedAt: FieldValue.serverTimestamp(), // Set updatedAt same as createdAt initially
        });
        console.log(`API POST /api/placement/drive: Drive created ID: ${docRef.id} by user ${uid}`);

        // 6. Return Success Response
        // Indicate success and provide the ID of the newly created drive
        return NextResponse.json(
            { message: "Placement drive created successfully", driveId: docRef.id },
            { status: 201 } // HTTP 201 Created status
        );

    } catch (error: any) {
        console.error("❌ POST /api/placement/drive Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An internal server error occurred.";
        // Log stack trace for server-side debugging
        if (error instanceof Error && error.stack) { console.error("Stack Trace:", error.stack); }
        // Return a standardized error response
        return NextResponse.json( { error: "Failed to create placement drive", details: errorMessage }, { status: 500 });
    }
}