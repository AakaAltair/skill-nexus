// app/api/placement/achievements/[achievementId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin'; // Adjust path if needed
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
// Import StudentAchievement and PlacementType types (Adjust path if needed)
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


// --- GET Handler: Fetch Single Student Achievement ---
// Retrieves details for one specific achievement post based on its ID provided in the URL path.
export async function GET(
    request: NextRequest,
    // Correctly destructure params containing the dynamic route segment ([achievementId])
    { params }: { params: { achievementId: string } }
) {
    // Access achievementId from the destructured params
    // --- FIX: AWAIT PARAMS ---
    const { achievementId } = await params;
    console.log(`--- GET /api/placement/achievements/${achievementId} ---`);

    try {
        // Ensure Firestore service is available
        if (!firestore) {
            console.error("GET /api/placement/achievements/[id] Error: Firestore service is not available.");
            throw new Error("Firestore not initialized.");
        }
        // Validate the ID from the route
        if (!achievementId) {
            return NextResponse.json({ error: "Achievement ID missing" }, { status: 400 });
        }

        // Get reference to the specific achievement document
        const achievementDocRef = firestore.collection('studentAchievements').doc(achievementId);
        const docSnap = await achievementDocRef.get(); // Fetch the document

        // Handle achievement not found
        if (!docSnap.exists) {
            console.log(`Achievement ${achievementId} not found.`);
            return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
        }

        // Extract data, handle potential undefined
        const achievementData = docSnap.data();
        if (!achievementData) {
             console.error(`Failed to retrieve data for existing achievement ${achievementId}`);
             throw new Error("Failed to retrieve achievement data after finding document.");
        }

        // Convert any Firestore Timestamps in the data to ISO strings
        const dataWithConvertedDates = convertTimestamps(achievementData);

        // Explicitly construct the object matching the StudentAchievement type
        // Access fields safely using nullish coalescing (??) for defaults
        // Ensure this structure matches lib/types/placement.ts exactly
        const achievement: StudentAchievement = {
            id: docSnap.id, // Include the document ID
            // Creator Info
            creatorId: dataWithConvertedDates.creatorId ?? '',
            creatorName: dataWithConvertedDates.creatorName ?? 'Unknown Poster',
            creatorPhotoURL: dataWithConvertedDates.creatorPhotoURL ?? '/default-avatar.png',
            // Placed Student Info
            placedStudentName: dataWithConvertedDates.placedStudentName ?? 'Unknown Student',
            placedStudentBranch: dataWithConvertedDates.placedStudentBranch ?? '',
            placedStudentYear: dataWithConvertedDates.placedStudentYear ?? '',
            placedStudentPhotoURL: dataWithConvertedDates.placedStudentPhotoURL ?? '',
            // Placement Details
            companyName: dataWithConvertedDates.companyName ?? 'Unknown Company',
            companyLogoURL: dataWithConvertedDates.companyLogoURL ?? '',
            roleTitle: dataWithConvertedDates.roleTitle ?? '',
            placementType: dataWithConvertedDates.placementType ?? 'Other',
            location: dataWithConvertedDates.location ?? '',
            salary: dataWithConvertedDates.salary ?? '',
            // Content Fields
            jobDescription: dataWithConvertedDates.jobDescription ?? '',
            skills: Array.isArray(dataWithConvertedDates.skills) ? dataWithConvertedDates.skills : [],
            text: dataWithConvertedDates.text ?? '', // Main message/experience
            personalMessage: dataWithConvertedDates.personalMessage ?? '',
            // Timestamps
            createdAt: dataWithConvertedDates.createdAt ?? new Date(0).toISOString(),
            updatedAt: dataWithConvertedDates.updatedAt ?? dataWithConvertedDates.createdAt ?? new Date(0).toISOString(), // Fallback updated to created
        };

        console.log(`Successfully fetched achievement: ${achievementId}`);
        // Return the single achievement wrapped in an object: { achievement: ... }
        return NextResponse.json({ achievement });

    } catch (error: any) {
        console.error(`❌ GET /api/placement/achievements/${achievementId} Error:`, error);
        const msg = error instanceof Error ? error.message : "Internal server error.";
        // Return a standardized error response
        return NextResponse.json({ error: "Failed to fetch achievement", details: msg }, { status: 500 });
    }
}


// --- PATCH Handler: Update Student Achievement ---
// Allows the user who created the post to update its editable details.
export async function PATCH(
    request: NextRequest,
    // Correctly destructure params
    { params }: { params: { achievementId: string } }
) {
    // Access achievementId from the destructured params
     // --- FIX: AWAIT PARAMS ---
    const { achievementId } = await params;
    console.log(`--- PATCH /api/placement/achievements/${achievementId} ---`);
    try {
        // Initial checks for services and ID
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!achievementId) { return NextResponse.json({ error: "Achievement ID missing" }, { status: 400 }); }

        // 1. Verify User Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try {
            // Verify token using Admin SDK
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ PATCH Token verification failed:", authError);
             // Check for specific Firebase Auth errors for more precise status codes/messages
             if (authError.code === 'auth/argument-error' || authError.code === 'auth/id-token-expired' || authError.code === 'auth/id-token-revoked') {
                  return NextResponse.json({ error: "Unauthorized: Invalid or expired token", details: authError.message }, { status: 403 });
             }
            return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid; // ID of the user making the request

        // 2. Get Achievement Document and Verify Ownership
        const achievementDocRef = firestore.collection('studentAchievements').doc(achievementId);
        const docSnap = await achievementDocRef.get();

        // Check if the document exists
        if (!docSnap.exists) {
            return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
        }

        const currentData = docSnap.data();
        // Authorization Check: Ensure the requesting user is the CREATOR of the post
        if (!currentData || currentData.creatorId !== uid) {
            console.warn(`User ${uid} attempted PATCH on achievement ${achievementId} created by ${currentData?.creatorId}`);
            return NextResponse.json({ error: "Forbidden: You can only edit posts you created" }, { status: 403 });
        }

        // 3. Parse Request Body containing updated fields
        let body;
        try {
             body = await request.json();
        } catch (parseError) {
             console.error("Failed to parse PATCH request body:", parseError);
             return NextResponse.json({ error: "Invalid request body: Failed to parse JSON." }, { status: 400 });
        }
        console.log("Received PATCH body:", JSON.stringify(body, null, 2));


        // 4. Define Editable Fields and Validate/Build Update Payload
        // List all fields a user is allowed to modify
        const allowedFields: Array<keyof StudentAchievement> = [
            // Placed Student Info
            'placedStudentName', 'placedStudentBranch', 'placedStudentYear', 'placedStudentPhotoURL',
            // Placement Details
            'companyName', 'companyLogoURL', 'roleTitle', 'placementType', 'location', 'salary',
            // Content Fields
            'jobDescription', 'skills', 'text', 'personalMessage'
            // Exclude creatorId, creatorName, creatorPhotoURL, createdAt, updatedAt
        ];
        const updateData: Record<string, any> = {}; // Object to hold validated fields for the update

        // Iterate through allowed fields and add them to updateData if present and valid
        for (const key of allowedFields) {
            // Check if the field exists in the request body (allows sending null to clear a field)
            // Also checks if the value is different from the current value before including (optional optimization)
            // For simplicity, let's add it if it's *provided* in the body, even if it's the same value.
            // The frontend comparison logic already handles sending only changes.
             if (body.hasOwnProperty(key)) { // Use hasOwnProperty to check for undefined/null explicitly
                const value = body[key];

                // --- Validation Rules ---
                if (key === 'placedStudentName' && (value === null || typeof value !== 'string' || value.trim() === '')) {
                     console.warn(`PATCH validation failed: Required field '${key}' cannot be empty or null.`);
                     return NextResponse.json({ error: `Required field '${key}' cannot be empty.` }, { status: 400 });
                }
                if (key === 'companyName' && (value === null || typeof value !== 'string' || value.trim() === '')) {
                      console.warn(`PATCH validation failed: Required field '${key}' cannot be empty or null.`);
                      return NextResponse.json({ error: `Required field '${key}' cannot be empty.` }, { status: 400 });
                 }
                if (key === 'text' && (value === null || typeof value !== 'string' || value.trim() === '')) {
                     console.warn(`PATCH validation failed: Required field '${key}' cannot be empty or null.`);
                     return NextResponse.json({ error: `Required field '${key}' cannot be empty.` }, { status: 400 });
                }
                 if (key === 'skills' && value !== null && !Array.isArray(value)) {
                     console.warn(`PATCH validation failed: Field '${key}' must be an array or null.`);
                      return NextResponse.json({ error: `Field '${key}' must be an array or null.` }, { status: 400 });
                 }
                if (key === 'placementType' && value !== null && value !== '' && !['Full-time', 'Internship', 'PPO', 'Other'].includes(value)) {
                     console.warn(`PATCH validation failed: Invalid placementType '${value}'.`);
                      return NextResponse.json({ error: `Invalid value for field '${key}'.` }, { status: 400 });
                }
                // Add more validation rules here as needed...

                // --- Add valid field to payload ---
                // Trim strings, keep null as null, keep other types as is
                updateData[key] = value === null ? null : (typeof value === 'string' ? value.trim() : value);
                 // Optionally convert empty strings to null for optional fields if they are not required
                 // Check if the field is NOT a required field before converting empty string to null
                 const requiredFields = ['placedStudentName', 'companyName', 'text']; // List required fields
                 if (!requiredFields.includes(key) && updateData[key] === '') {
                     updateData[key] = null;
                 }
            }
        }

        // Ensure critical immutable fields are not accidentally included
        delete updateData.creatorId; delete updateData.creatorName; delete updateData.creatorPhotoURL;
        delete updateData.studentId; delete updateData.studentName; delete updateData.studentPhotoURL; // Remove old fields if they sneak in
        delete updateData.createdAt; // Do not allow changing creation date
        delete updateData.updatedAt; // This will be set by the server timestamp

        // Check if there's anything actually being updated after validation
        if (Object.keys(updateData).length === 0) {
             console.log("PATCH request received with no valid fields to update.");
            return NextResponse.json({ message: "No valid fields provided for update" }, { status: 400 });
        }

        // 5. Add the 'updatedAt' Server Timestamp to mark modification time
        updateData.updatedAt = FieldValue.serverTimestamp();

        // 6. Perform the Firestore Update Operation
        await achievementDocRef.update(updateData);
        console.log(`Achievement ${achievementId} updated successfully by creator ${uid}. Fields updated: ${Object.keys(updateData).join(', ')}`);

        // 7. Fetch and Return the Updated Achievement Data
        // Re-fetch the document to get the data with the server-generated updatedAt timestamp and other unchanged fields
        const updatedDocSnap = await achievementDocRef.get();
        const updatedData = updatedDocSnap.data();
        if (updatedData) {
            // Construct the full achievement object with converted timestamps
            const achievement: StudentAchievement = {
                id: updatedDocSnap.id,
                 // Map all fields explicitly to ensure type safety and defaults
                 creatorId: updatedData.creatorId ?? '',
                 creatorName: updatedData.creatorName ?? 'Unknown Poster',
                 creatorPhotoURL: updatedData.creatorPhotoURL ?? '/default-avatar.png',
                 placedStudentName: updatedData.placedStudentName ?? 'Unknown Student',
                 placedStudentBranch: updatedData.placedStudentBranch ?? '',
                 placedStudentYear: updatedData.placedStudentYear ?? '',
                 placedStudentPhotoURL: updatedData.placedStudentPhotoURL ?? '',
                 companyName: updatedData.companyName ?? 'Unknown Company',
                 companyLogoURL: updatedData.companyLogoURL ?? '',
                 roleTitle: updatedData.roleTitle ?? '',
                 placementType: updatedData.placementType ?? 'Other',
                 text: updatedData.text ?? '',
                 skills: Array.isArray(updatedData.skills) ? updatedData.skills : [],
                 location: updatedData.location ?? '',
                 salary: updatedData.salary ?? '',
                 jobDescription: updatedData.jobDescription ?? '',
                 personalMessage: updatedData.personalMessage ?? '',
                 // Use the converter helper for consistency and robustness
                 createdAt: convertTimestamps({ createdAt: updatedData.createdAt }).createdAt,
                 updatedAt: convertTimestamps({ updatedAt: updatedData.updatedAt }).updatedAt,
            };
            // Return success message along with the updated achievement data
            return NextResponse.json({ message: "Achievement updated successfully", achievement });
        } else {
            // This case should be rare if the update operation itself didn't throw an error
            console.error(`Failed to retrieve updated data for achievement ${achievementId} after PATCH.`);
            return NextResponse.json({ message: "Achievement updated, but failed to retrieve updated data." });
        }

    } catch (error: any) {
        console.error(`❌ PATCH /api/placement/achievements/${achievementId} Error:`, error);
        const msg = error instanceof Error ? error.message : "Internal server error.";
        // Return a standardized error response
        return NextResponse.json({ error: "Failed to update achievement", details: msg }, { status: 500 });
    }
}


// --- DELETE Handler: Delete Student Achievement ---
// Allows the user who created the post to delete it.
export async function DELETE(
    request: NextRequest,
    // Correctly destructure params
    { params }: { params: { achievementId: string } }
) {
    // Access achievementId from the destructured params
     // --- FIX: AWAIT PARAMS ---
    const { achievementId } = await params;
    console.log(`--- DELETE /api/placement/achievements/${achievementId} ---`);
    try {
        // Initial checks
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!achievementId) { return NextResponse.json({ error: "Achievement ID missing" }, { status: 400 }); }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token" }, { status: 401 }); }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ DELETE Token verification failed:", authError);
              if (authError.code === 'auth/argument-error' || authError.code === 'auth/id-token-expired' || authError.code === 'auth/id-token-revoked') {
                  return NextResponse.json({ error: "Unauthorized: Invalid or expired token", details: authError.message }, { status: 403 });
              }
            return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid; // ID of user attempting delete

        // 2. Get Achievement Document and Verify Ownership
        const achievementDocRef = firestore.collection('studentAchievements').doc(achievementId);
        const docSnap = await achievementDocRef.get();

        // Check if document exists
        if (!docSnap.exists) {
            return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
        }

        const data = docSnap.data();
        // Authorization Check: Ensure the requesting user is the CREATOR of the post
        if (!data || data.creatorId !== uid) {
            console.warn(`User ${uid} attempted DELETE on achievement ${achievementId} created by ${data?.creatorId}`);
            return NextResponse.json({ error: "Forbidden: You can only delete posts you created" }, { status: 403 });
        }

        // 3. Delete Firestore Document
        // TODO: Implement Cloud Function or explicit code here to delete subcollections (comments, likes)
        // and associated Storage files if you add them later. Firestore document delete does NOT cascade.
        await achievementDocRef.delete();
        console.log(`Achievement ${achievementId} deleted successfully by creator ${uid}.`);

        // 4. Return Success Response
        return NextResponse.json({ message: "Achievement deleted successfully" }, { status: 200 });
        // Alternative: return new NextResponse(null, { status: 204 }); // 204 No Content

    } catch (error: any) {
        console.error(`❌ DELETE /api/placement/achievements/${achievementId} Error:`, error);
        const msg = error instanceof Error ? error.message : "Internal server error.";
        // Return a standardized error response
        return NextResponse.json({ error: "Failed to delete achievement", details: msg }, { status: 500 });
    }
}