// app/api/placement/drives/[driveId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin'; // Adjust path if needed
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { PlacementDrive, PlacementStatus } from '@/lib/types/placement'; // Adjust path if needed

// --- Helper Function to Convert Timestamps (Including nested keyDates) ---
// (Consistent with the /api/placement/drive/route.ts helper)
const convertTimestamps = (data: Record<string, any>): Record<string, any> => {
    const converted: Record<string, any> = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            converted[key] = value.toDate().toISOString();
        } else if (key === 'keyDates' && value && typeof value === 'object') {
             converted[key] = {};
             for(const dateKey in value) {
                 if (value[dateKey] instanceof Timestamp) {
                     converted[key][dateKey] = value[dateKey].toDate().toISOString();
                 } else {
                     converted[key][dateKey] = value[dateKey];
                 }
             }
        } else {
            converted[key] = value;
        }
    }
    return converted;
};

// --- GET Handler: Fetch Single Placement Drive ---
export async function GET(
    request: NextRequest,
    { params }: { params: { driveId: string } } // Correct param name from folder structure
) {
    const driveId = params.driveId;
    console.log(`--- GET /api/placement/drives/${driveId} ---`);

    try {
        if (!firestore) { throw new Error("Firestore not initialized."); }
        if (!driveId) { return NextResponse.json({ error: "Drive ID is missing." }, { status: 400 }); }

        const driveDocRef = firestore.collection('placementDrives').doc(driveId); // Correct collection
        const docSnap = await driveDocRef.get();

        if (!docSnap.exists) {
            console.log(`Placement drive ${driveId} not found.`);
            return NextResponse.json({ error: "Placement drive not found" }, { status: 404 });
        }

        const driveData = docSnap.data();
        if (!driveData) { throw new Error("Failed to retrieve drive data after finding document."); }

        // Convert Timestamps before sending
        const driveWithConvertedDates = convertTimestamps(driveData);

        // Construct the final object matching the type
        const drive: PlacementDrive = {
            id: docSnap.id,
            ...driveWithConvertedDates,
        } as PlacementDrive; // Assert type

        console.log(`Successfully fetched placement drive: ${driveId}`);
        // Return consistent { drive: ... } structure
        return NextResponse.json({ drive });

    } catch (error: any) {
        console.error(`❌ GET /api/placement/drives/${driveId} Error:`, error);
        const errorMessage = error.message || "Internal server error fetching drive.";
        return NextResponse.json({ error: "Failed to fetch placement drive", details: errorMessage }, { status: 500 });
    }
}


// --- PATCH Handler: Update Placement Drive ---
export async function PATCH(
    request: NextRequest,
    { params }: { params: { driveId: string } }
) {
    const driveId = params.driveId;
    console.log(`--- PATCH /api/placement/drives/${driveId} ---`);

    try {
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!driveId) { return NextResponse.json({ error: "Drive ID is missing." }, { status: 400 }); }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); }
        catch (authError: any) { return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 }); }
        const uid = decodedToken.uid;

        // 2. Get Drive Doc and Verify Ownership/Permissions
        const driveDocRef = firestore.collection('placementDrives').doc(driveId);
        const docSnap = await driveDocRef.get();

        if (!docSnap.exists) { return NextResponse.json({ error: "Placement drive not found" }, { status: 404 }); }

        const currentData = docSnap.data();
        // *** Authorization Check: Ensure user is the original poster ***
        // *** TODO: Implement proper Admin/Role check here if others can edit ***
        if (!currentData || currentData.postedById !== uid) {
            console.warn(`User ${uid} attempted PATCH on drive ${driveId} owned by ${currentData?.postedById}`);
            return NextResponse.json({ error: "Forbidden: You do not have permission to edit this drive" }, { status: 403 });
        }

        // 3. Parse and Validate Request Body
        const body = await request.json();
        console.log("Received PATCH body:", JSON.stringify(body, null, 2));

        // Define fields allowed for update
        const allowedFields: Array<keyof PlacementDrive> = [
            'companyName', 'companyLogoURL', 'roleTitle', 'description', 'eligibilityCriteria',
            'status', 'keyDates', 'packageDetails', 'applicationLink', 'applicationInstructions',
            'location', 'eligibleBranches', 'contactPerson', 'commentsEnabled'
        ];
        const updateData: Record<string, any> = {};

        for (const key of allowedFields) {
            if (body[key] !== undefined) {
                // Add specific validation per field if needed
                if (key === 'eligibleBranches' && !Array.isArray(body[key])) continue; // Skip if not array
                if (key === 'keyDates' && typeof body[key] !== 'object') continue; // Skip if not object
                // TODO: Validate status enum, date formats within keyDates?
                updateData[key] = body[key];
            }
        }

        // Ensure critical fields are not changed
        delete updateData.postedById;
        delete updateData.createdAt;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "No valid fields provided for update" }, { status: 400 });
        }

        // 4. Add updatedAt Timestamp
        updateData.updatedAt = FieldValue.serverTimestamp();

        // 5. Perform Update
        await driveDocRef.update(updateData);
        console.log(`Placement drive ${driveId} updated successfully by user ${uid}. Fields: ${Object.keys(updateData).join(', ')}`);

        // 6. Fetch and Return Updated Drive Data
         const updatedDocSnap = await driveDocRef.get();
         const updatedData = updatedDocSnap.data();
         if (updatedData) {
             const drive: PlacementDrive = {
                 id: updatedDocSnap.id,
                 ...convertTimestamps(updatedData), // Convert timestamps before returning
             } as PlacementDrive;
             return NextResponse.json({ message: "Placement drive updated successfully", drive });
         } else {
             return NextResponse.json({ message: "Placement drive updated, but failed to retrieve updated data." });
         }

    } catch (error: any) {
        console.error(`❌ PATCH /api/placement/drives/${driveId} Error:`, error);
        const errorMessage = error.message || "Internal server error updating drive.";
        return NextResponse.json({ error: "Failed to update placement drive", details: errorMessage }, { status: 500 });
    }
}


// --- DELETE Handler: Delete Placement Drive ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { driveId: string } }
) {
    const driveId = params.driveId;
    console.log(`--- DELETE /api/placement/drives/${driveId} ---`);

    try {
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!driveId) { return NextResponse.json({ error: "Drive ID is missing." }, { status: 400 }); }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); }
        catch (authError: any) { return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 }); }
        const uid = decodedToken.uid;

        // 2. Get Drive Doc and Verify Ownership/Permissions
        const driveDocRef = firestore.collection('placementDrives').doc(driveId);
        const docSnap = await driveDocRef.get();

        if (!docSnap.exists) { return NextResponse.json({ error: "Placement drive not found" }, { status: 404 }); }

        const data = docSnap.data();
        // *** Authorization Check: Ensure user is the original poster ***
        // *** TODO: Implement proper Admin/Role check here if others can delete ***
        if (!data || data.postedById !== uid) {
            console.warn(`User ${uid} attempted DELETE on drive ${driveId} owned by ${data?.postedById}`);
            return NextResponse.json({ error: "Forbidden: You do not have permission to delete this drive" }, { status: 403 });
        }

        // 3. Delete Firestore Document
        // IMPORTANT: This does NOT delete subcollections (comments) or associated storage files.
        // Implement subcollection/storage deletion logic here or in a Cloud Function trigger if needed.
        await driveDocRef.delete();
        console.log(`Placement drive ${driveId} deleted successfully by user ${uid}.`);

        // 4. Return Success Response
        return NextResponse.json({ message: "Placement drive deleted successfully" }, { status: 200 });
        // Or return status 204 (No Content) which doesn't need a body:
        // return new NextResponse(null, { status: 204 });

    } catch (error: any) {
        console.error(`❌ DELETE /api/placement/drives/${driveId} Error:`, error);
        const errorMessage = error.message || "Internal server error deleting drive.";
        return NextResponse.json({ error: "Failed to delete placement drive", details: errorMessage }, { status: 500 });
    }
}