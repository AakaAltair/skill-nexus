// app/api/placement/drives/[driveId]/updates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin'; // Adjust path if needed
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
// Import PlacementUpdate and Attachment types
import { PlacementUpdate, Attachment } from '@/lib/types/placement'; // Adjust path if needed

// --- Helper Function to get Placement Drive Document Reference ---
function getDriveRef(driveId: string) {
    // Basic validation for the drive ID
    if (!firestore) {
        // This condition should ideally be checked before calling, but good safety net
        console.error("Firestore service is not available.");
        throw new Error("Firestore not initialized.");
    }
    if (!driveId || typeof driveId !== 'string' || driveId.trim() === '') {
        console.error("Invalid driveId provided to getDriveRef:", driveId);
        throw new Error("Placement Drive ID missing or invalid format.");
    }
    // Return the document reference
    return firestore.collection('placementDrives').doc(driveId);
}


// --- GET Handler: Fetch Updates for a Specific Placement Drive ---
export async function GET(
    request: NextRequest,
    // Correctly destructure params from the second argument in App Router Route Handlers
    { params }: { params: { driveId: string } }
) {
    // Access driveId from the destructured params
    const driveId = params.driveId;
    console.log(`--- GET /api/placement/drives/${driveId}/updates ---`);
    try {
        // Validate driveId *after* accessing it
        if (!driveId) {
            return NextResponse.json({ error: "Placement Drive ID missing" }, { status: 400 });
        }
        // Check if firestore is initialized (optional extra check)
        if (!firestore) {
             throw new Error("Firestore not initialized.");
        }

        const driveRef = getDriveRef(driveId); // Get reference to the parent drive document
        const updatesCollectionRef = driveRef.collection('updates'); // Reference the 'updates' subcollection

        // Query the subcollection, order by creation date descending, limit results
        const queryRef = updatesCollectionRef.orderBy('createdAt', 'desc').limit(50); // Fetch latest 50 updates
        const querySnapshot = await queryRef.get();

        // Map the documents to the PlacementUpdate type
        const updates = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Basic structure assertion and default values
            const updateData: Omit<PlacementUpdate, 'id'> & { id: string } = {
                id: doc.id,
                authorId: data.authorId || '',
                authorName: data.authorName || 'Unknown Author',
                authorPhotoURL: data.authorPhotoURL || '/default-avatar.png', // Default avatar
                content: data.content || '',
                // Validate and filter attachments array (assuming Attachment type is defined)
                attachments: Array.isArray(data.attachments) ? data.attachments.filter(
                    (att: any): att is Attachment =>
                        att && typeof att.name === 'string' &&
                        typeof att.url === 'string' && // URL might be placeholder initially
                        typeof att.type === 'string' && ['link', 'file', 'image'].includes(att.type)
                ) : [], // Default to empty array if 'attachments' is missing or not an array
                // Convert timestamp to ISO string for JSON compatibility
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
            return updateData as PlacementUpdate; // Assert final type
        });

        console.log(`Found ${updates.length} updates for drive ${driveId}.`);
        // Return the updates array wrapped in an object
        return NextResponse.json({ updates });

    } catch (error: any) {
        console.error(`❌ GET /updates Error for drive ${driveId}:`, error);
        // Handle specific errors like invalid ID if thrown by helper
        if (error.message?.includes("ID missing or invalid")) {
            return NextResponse.json({ error: "Invalid Placement Drive ID format provided." }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : "Internal server error fetching updates.";
        return NextResponse.json({ error: "Failed to fetch placement drive updates", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create a New Update for a Placement Drive ---
export async function POST(
    request: NextRequest,
    // Correctly destructure params
    { params }: { params: { driveId: string } }
) {
    // Access driveId from the destructured params
    const driveId = params.driveId;
    console.log(`--- POST /api/placement/drives/${driveId}/updates ---`);
    try {
        // Initial checks
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!driveId) { return NextResponse.json({ error: "Placement Drive ID missing" }, { status: 400 }); }

        // 1. Verify User Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ Token verification failed:", authError);
             const detail = authError.code === 'auth/id-token-expired' ? 'Token expired.' : authError.message;
             return NextResponse.json({ error: "Unauthorized: Invalid token", details: detail }, { status: 403 });
        }
        // Extract user info from verified token
        const uid = decodedToken.uid;
        const userName = decodedToken.name || "Placement Admin"; // Default name if not in token
        const userPhoto = decodedToken.picture || "/default-avatar.png"; // Default photo

        // 2. Verify Ownership/Permissions (User posting must be the drive poster)
        // TODO: Implement Admin/Role check here if non-posters can add updates
        const driveRef = getDriveRef(driveId); // Get reference using helper
        const driveSnap = await driveRef.get();
        if (!driveSnap.exists) { return NextResponse.json({ error: "Placement drive not found" }, { status: 404 }); }
        // Check if the authenticated user is the one who posted the drive
        if (driveSnap.data()?.postedById !== uid) {
            console.warn(`User ${uid} attempted update on drive ${driveId} owned by ${driveSnap.data()?.postedById}`);
            return NextResponse.json({ error: "Forbidden: Only the drive poster can post updates" }, { status: 403 });
        }

        // 3. Parse Request Body
        let body;
        try {
             body = await request.json();
        } catch (parseError) {
             console.error("Failed to parse request body:", parseError);
             return NextResponse.json({ error: "Invalid request body: Failed to parse JSON." }, { status: 400 });
        }
        const { content, attachments } = body;

        // 4. Validate Input
        if (!content || typeof content !== 'string' || content.trim() === '') {
            return NextResponse.json({ error: "Update content cannot be empty" }, { status: 400 });
        }
        // Basic validation for attachments structure (assuming type/url/name from frontend)
        let validAttachments: Attachment[] = [];
        if (attachments) {
            if (Array.isArray(attachments)) {
                validAttachments = attachments.filter(
                    (att: any): att is Attachment => // Type guard
                        att && typeof att.name === 'string' && att.name.trim() !== '' &&
                        typeof att.url === 'string' && // URL might be placeholder initially
                        typeof att.type === 'string' && ['link', 'file', 'image'].includes(att.type)
                );
                if(validAttachments.length < attachments.length){
                    console.warn("Some provided attachments were invalid or incomplete and were ignored.");
                }
            } else {
                 console.warn("Received 'attachments' field, but it wasn't an array. Ignoring attachments.");
            }
        }

        // 5. Prepare Update Data for Firestore
        const newUpdateData: Omit<PlacementUpdate, 'id' | 'createdAt'> = {
            authorId: uid, // ID of the user making the update
            authorName: userName, // Name from token
            authorPhotoURL: userPhoto, // Photo from token
            content: content.trim(), // Trimmed update content
            attachments: validAttachments, // Use validated/filtered attachments array
        };

        // 6. Add Update to the 'updates' Subcollection
        const updatesCollectionRef = driveRef.collection('updates');
        const docRef = await updatesCollectionRef.add({
            ...newUpdateData,
            createdAt: FieldValue.serverTimestamp(), // Use server timestamp for creation time
        });
        console.log(`Placement update ${docRef.id} added to drive ${driveId} by user ${uid}.`);

        // 7. Update parent drive's 'updatedAt' timestamp
        try {
            await driveRef.update({ updatedAt: FieldValue.serverTimestamp() });
             console.log(`Drive ${driveId} 'updatedAt' timestamp updated.`);
        } catch (updateError) {
             // Log error but don't fail the request, as the update was posted
             console.error(`Failed to update drive timestamp for ${driveId}:`, updateError);
        }

        // 8. Return Success Response
        return NextResponse.json(
             { message: "Update posted successfully", updateId: docRef.id },
             { status: 201 } // HTTP 201 Created
        );

    } catch (error: any) {
        console.error(`❌ POST /updates Error for drive ${driveId}:`, error);
         if (error.message?.includes("ID missing or invalid")) {
            return NextResponse.json({ error: "Invalid Placement Drive ID format provided." }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json({ error: "Failed to post placement update", details: errorMessage }, { status: 500 });
    }
}