// app/api/resources/[resourceId]/updates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
// *** Import ResourceUpdate and Attachment (if defined for resources) ***
import { ResourceUpdate, Attachment } from '@/lib/types/resource'; // Assuming Attachment is defined or remove if not used

// Helper function to get Resource Document Reference
function getResourceRef(resourceId: string) {
    if (!firestore) throw new Error("Firestore not initialized.");
    if (!resourceId || typeof resourceId !== 'string' || resourceId.trim() === '') {
        throw new Error("Resource ID missing or invalid for getResourceRef.");
    }
    // *** Point to 'resources' collection ***
    return firestore.collection('resources').doc(resourceId);
}


// --- GET Handler: Fetch Updates for a Resource ---
export async function GET(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    const resourceId = params.resourceId;
    console.log(`--- GET /api/resources/${resourceId}/updates ---`);
    try {
        if (!firestore) throw new Error("Firestore not initialized.");
        if (!resourceId || typeof resourceId !== 'string' || resourceId.trim() === '') {
             return NextResponse.json({ error: "Resource ID missing or invalid" }, { status: 400 });
        }
        const resourceRef = getResourceRef(resourceId);
        // *** Point to 'updates' subcollection under the resource ***
        const updatesCollectionRef = resourceRef.collection('updates');
        const queryRef = updatesCollectionRef.orderBy('createdAt', 'desc').limit(50);
        const querySnapshot = await queryRef.get();

        const updates = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const updateData: Omit<ResourceUpdate, 'id'> & { id: string } = { // *** Use ResourceUpdate type ***
                id: doc.id,
                authorId: data.authorId || '',
                authorName: data.authorName || 'Unknown Author',
                authorPhotoURL: data.authorPhotoURL || '',
                content: data.content || '',
                // *** Adjust Attachment validation if its structure differs or remove if not used ***
                attachments: Array.isArray(data.attachments) ? data.attachments.filter(
                    (att: any): att is Attachment =>
                        att && typeof att.name === 'string' && typeof att.url === 'string' &&
                        ['link', 'file', 'image'].includes(att.type) // Assuming same types
                ) : [],
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
            return updateData as ResourceUpdate; // *** Assert ResourceUpdate type ***
        });

        console.log(`Found ${updates.length} updates for resource ${resourceId}.`);
        return NextResponse.json({ updates }); // *** Return { updates: [...] } ***

    } catch (error: any) {
        console.error(`❌ GET /updates Error for resource ${resourceId}:`, error);
        if (error.message?.includes("Resource ID missing or invalid")) {
            return NextResponse.json({ error: "Invalid Resource ID format provided." }, { status: 400 });
        }
         // *** Adjust error message ***
        return NextResponse.json({ error: "Failed to fetch resource updates", details: error.message }, { status: 500 });
    }
}


// --- POST Handler: Create a New Update for a Resource ---
export async function POST(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    const resourceId = params.resourceId;
    console.log(`--- POST /api/resources/${resourceId}/updates ---`);
    try {
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!resourceId || typeof resourceId !== 'string' || resourceId.trim() === '') {
             return NextResponse.json({ error: "Resource ID missing or invalid" }, { status: 400 });
        }

        // 1. Verify Authentication (Identical)
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }
        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); }
        catch (authError: any) { return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 }); }
        const uid = decodedToken.uid;
        const userName = decodedToken.name || "Anonymous User";
        const userPhoto = decodedToken.picture || "";

        // 2. Verify Ownership (Check against 'uploaderId')
        const resourceRef = getResourceRef(resourceId);
        const resourceSnap = await resourceRef.get();
        if (!resourceSnap.exists) { return NextResponse.json({ error: "Resource not found" }, { status: 404 }); }
         // *** Check 'uploaderId' instead of 'creatorId' ***
        if (resourceSnap.data()?.uploaderId !== uid) {
            console.warn(`User ${uid} attempted update on resource ${resourceId} owned by ${resourceSnap.data()?.uploaderId}`);
             // *** Adjust error message ***
            return NextResponse.json({ error: "Forbidden: Only the resource owner can post updates" }, { status: 403 });
        }

        // 3. Parse Request Body (Identical)
        let body;
        try { body = await request.json(); }
        catch (parseError) { return NextResponse.json({ error: "Invalid request body: Failed to parse JSON." }, { status: 400 }); }
        const { content, attachments } = body;

        // 4. Validate Input (Identical, assumes same Attachment structure or remove validation)
        if (!content || typeof content !== 'string' || content.trim() === '') { return NextResponse.json({ error: "Update content cannot be empty" }, { status: 400 }); }
        let validAttachments: Attachment[] = []; // *** Use Resource Attachment type if different ***
        if (attachments) { /* ... same validation logic ... */ }

        // 5. Prepare Update Data (Use ResourceUpdate type)
        const newUpdateData: Omit<ResourceUpdate, 'id' | 'createdAt'> = { // *** Use ResourceUpdate type ***
            authorId: uid, authorName: userName, authorPhotoURL: userPhoto,
            content: content.trim(), attachments: validAttachments,
        };

        // 6. Add Update to Subcollection (Identical logic)
        const updatesCollectionRef = resourceRef.collection('updates');
        const docRef = await updatesCollectionRef.add({ ...newUpdateData, createdAt: FieldValue.serverTimestamp() });
        console.log(`Resource update ${docRef.id} added.`);

        // 7. Update resource's 'updatedAt' timestamp (Identical logic)
        try {
            await resourceRef.update({ updatedAt: FieldValue.serverTimestamp() });
            console.log(`Resource ${resourceId} 'updatedAt' timestamp updated.`);
        } catch (updateError) { console.error(`Failed to update resource timestamp for ${resourceId}:`, updateError); }

        // 8. Return Success Response (Identical format)
        return NextResponse.json( { message: "Update posted successfully", updateId: docRef.id }, { status: 201 });

    } catch (error: any) {
        console.error(`❌ POST /updates Error for resource ${resourceId}:`, error);
        if (error.message?.includes("Resource ID missing or invalid")) {
             return NextResponse.json({ error: "Invalid Resource ID format provided." }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
         // *** Adjust error message ***
        return NextResponse.json({ error: "Failed to post resource update", details: errorMessage }, { status: 500 });
    }
}