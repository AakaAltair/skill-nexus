// app/api/resources/[resourceId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { Resource } from '@/lib/types/resource'; // Import resource type

// --- Helper Function to Convert Timestamps ---
// (Can be moved to a utils file if used elsewhere)
const convertTimestamps = (data: Record<string, any>): Record<string, any> => {
    const converted: Record<string, any> = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            converted[key] = value.toDate().toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
             // Recursively convert nested objects if needed (likely not for Resource)
             // converted[key] = convertTimestamps(value);
             converted[key] = value; // Keep non-timestamp objects as is for now
        } else {
            converted[key] = value;
        }
    }
    return converted;
};


// --- GET Handler: Fetch Single Resource ---
export async function GET(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    const resourceId = params.resourceId;
    console.log(`--- GET /api/resources/${resourceId} ---`);

    try {
        if (!firestore) { throw new Error("Firestore not initialized."); }
        if (!resourceId) { throw new Error("Resource ID is missing."); }

        const resourceDocRef = firestore.collection('resources').doc(resourceId);
        const docSnap = await resourceDocRef.get();

        if (!docSnap.exists) {
            console.log(`Resource ${resourceId} not found.`);
            return NextResponse.json({ error: "Resource not found" }, { status: 404 });
        }

        const resourceData = docSnap.data();
        if (!resourceData) {
             // Should not happen if docSnap.exists is true, but good safety check
             throw new Error("Failed to retrieve resource data after finding document.");
        }

        // Convert Timestamps before sending
        const resourceWithConvertedDates = convertTimestamps(resourceData);

        const resource: Resource = {
            id: docSnap.id,
            ...resourceWithConvertedDates,
        } as Resource; // Assert the final type

        console.log(`Successfully fetched resource: ${resourceId}`);
        return NextResponse.json({ resource }); // Return as { resource: ... }

    } catch (error: any) {
        console.error(`❌ GET /api/resources/${resourceId} Error:`, error);
        const errorMessage = error.message || "Internal server error fetching resource.";
        return NextResponse.json({ error: "Failed to fetch resource", details: errorMessage }, { status: 500 });
    }
}


// --- PATCH Handler: Update Resource ---
export async function PATCH(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    const resourceId = params.resourceId;
    console.log(`--- PATCH /api/resources/${resourceId} ---`);

    try {
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!resourceId) { throw new Error("Resource ID is missing."); }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
            return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid;

        // 2. Get Resource Doc and Verify Ownership
        const resourceDocRef = firestore.collection('resources').doc(resourceId);
        const docSnap = await resourceDocRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Resource not found" }, { status: 404 });
        }

        const currentData = docSnap.data();
        if (!currentData || currentData.uploaderId !== uid) {
            console.warn(`User ${uid} attempted to update resource ${resourceId} owned by ${currentData?.uploaderId}`);
            return NextResponse.json({ error: "Forbidden: You do not have permission to edit this resource" }, { status: 403 });
        }

        // 3. Parse and Validate Request Body (only update allowed fields)
        const body = await request.json();
        console.log("Received PATCH body:", JSON.stringify(body, null, 2));

        const allowedFields: Array<keyof Resource> = [
            'title', 'description', 'linkURL', 'resourceType', 'branch', 'year',
            'college', 'subject', 'tags', 'commentsEnabled' // Add fields you want to allow updates for
        ];
        const updateData: Record<string, any> = {};

        for (const key of allowedFields) {
            // Check if the key exists in the body and is different from current data
            // (or if you simply want to allow setting it even if same/null)
            if (body[key] !== undefined) { // Check for existence, allow null/empty strings
                // Add validation if needed (e.g., check resourceType is valid)
                 if (key === 'tags' && !Array.isArray(body[key])) {
                     console.warn("PATCH validation failed: tags must be an array.");
                     return NextResponse.json({ error: "Invalid data format: 'tags' must be an array." }, { status: 400 });
                 }
                updateData[key] = body[key];
            }
        }

        // Ensure uploaderId cannot be changed
        delete updateData.uploaderId;
        delete updateData.createdAt; // Should not be updatable

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "No valid fields provided for update" }, { status: 400 });
        }

        // 4. Add updatedAt Timestamp
        updateData.updatedAt = FieldValue.serverTimestamp();

        // 5. Perform Update
        await resourceDocRef.update(updateData);
        console.log(`Resource ${resourceId} updated successfully by user ${uid}. Fields: ${Object.keys(updateData).join(', ')}`);

        // 6. Optionally Fetch and Return Updated Resource (or just success message)
         const updatedDocSnap = await resourceDocRef.get(); // Re-fetch
         const updatedData = updatedDocSnap.data();
         if (updatedData) {
             const resource: Resource = {
                 id: updatedDocSnap.id,
                 ...convertTimestamps(updatedData), // Convert timestamps
             } as Resource;
             return NextResponse.json({ message: "Resource updated successfully", resource });
         } else {
             // Should not happen if update succeeded, but handle defensively
             return NextResponse.json({ message: "Resource updated successfully, but could not retrieve updated data." });
         }

    } catch (error: any) {
        console.error(`❌ PATCH /api/resources/${resourceId} Error:`, error);
        const errorMessage = error.message || "Internal server error updating resource.";
        // Check for specific validation errors if needed
        return NextResponse.json({ error: "Failed to update resource", details: errorMessage }, { status: 500 });
    }
}


// --- DELETE Handler: Delete Resource ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    const resourceId = params.resourceId;
    console.log(`--- DELETE /api/resources/${resourceId} ---`);

    try {
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!resourceId) { throw new Error("Resource ID is missing."); }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
            return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid;

        // 2. Get Resource Doc and Verify Ownership
        const resourceDocRef = firestore.collection('resources').doc(resourceId);
        const docSnap = await resourceDocRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Resource not found" }, { status: 404 });
        }

        const data = docSnap.data();
        if (!data || data.uploaderId !== uid) {
            console.warn(`User ${uid} attempted to delete resource ${resourceId} owned by ${data?.uploaderId}`);
            return NextResponse.json({ error: "Forbidden: You do not have permission to delete this resource" }, { status: 403 });
        }

        // 3. Delete Firestore Document
        // TODO: Add deletion of subcollections (updates, comments) and Storage files later if needed
        await resourceDocRef.delete();
        console.log(`Resource ${resourceId} deleted successfully by user ${uid}.`);

        // 4. Return Success Response
        return NextResponse.json({ message: "Resource deleted successfully" }, { status: 200 });
        // Could also use status 204 (No Content) which doesn't typically have a body

    } catch (error: any) {
        console.error(`❌ DELETE /api/resources/${resourceId} Error:`, error);
        const errorMessage = error.message || "Internal server error deleting resource.";
        return NextResponse.json({ error: "Failed to delete resource", details: errorMessage }, { status: 500 });
    }
}