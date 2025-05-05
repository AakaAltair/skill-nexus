// app/api/resources/[resourceId]/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
// *** Import ResourceComment type ***
import { ResourceComment } from '@/lib/types/resource';

// --- GET Handler: Fetch ALL Comments for a Resource ---
export async function GET(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    console.log(`--- GET /api/resources/${params?.resourceId || 'undefined'}/comments (Fetching ALL for chat) ---`);
    try {
        const resourceId = params.resourceId;
        if (!resourceId || typeof resourceId !== 'string' || resourceId.trim() === '') {
             return NextResponse.json({ error: "Resource ID missing or invalid" }, { status: 400 });
        }
        if (!firestore) { throw new Error("Firestore not initialized."); }

        // *** Point to 'comments' subcollection under 'resources' ***
        const commentsCollectionRef = firestore
            .collection('resources').doc(resourceId)
            .collection('comments');

        const queryRef = commentsCollectionRef.orderBy('createdAt', 'asc').limit(200); // Fetch all for chat
        const querySnapshot = await queryRef.get();

        // Map Firestore documents to ResourceComment type
        const comments = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const commentData: Omit<ResourceComment, 'id'> & {id: string} = { // *** Use ResourceComment type ***
                id: doc.id,
                parentId: data.parentId || null,
                authorId: data.authorId || '',
                authorName: data.authorName || 'Anonymous',
                authorPhotoURL: data.authorPhotoURL || '',
                text: data.text || '',
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
                 // Remove updateId if not present in ResourceComment type
                 // updateId: data.updateId || null,
            };
            return commentData as ResourceComment; // *** Assert ResourceComment type ***
        });

        console.log(`Found ${comments.length} comments for resource ${resourceId}.`);
        return NextResponse.json({ comments }); // Return the flat list { comments: [...] }

    } catch (error: any) {
        console.error(`❌ GET /comments Error for resource ${params?.resourceId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
         // *** Adjust error message ***
        return NextResponse.json({ error: "Failed to fetch resource comments", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create a New Chat Message (Comment or Reply) for a Resource ---
export async function POST(
    request: NextRequest,
    { params }: { params: { resourceId: string } }
) {
    console.log(`--- POST /api/resources/${params?.resourceId || 'undefined'}/comments (New Chat Message/Reply) ---`);
    try {
        const resourceId = params.resourceId;
        if (!resourceId || typeof resourceId !== 'string' || resourceId.trim() === '') {
             return NextResponse.json({ error: "Resource ID missing or invalid" }, { status: 400 });
        }
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }

        // 1. Verify Authentication (Identical)
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }
        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); }
        catch (authError: any) { return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 }); }
        const uid = decodedToken.uid;
        const userName = decodedToken.name || "Anonymous";
        const userPhoto = decodedToken.picture || "";

        // 2. Check Resource Exists & Comments Enabled (using resource path)
        // *** Point to 'resources' collection ***
        const resourceRef = firestore.collection('resources').doc(resourceId);
        const resourceSnap = await resourceRef.get();
        if (!resourceSnap.exists) { return NextResponse.json({ error: "Resource not found" }, { status: 404 }); }
        // *** Check 'commentsEnabled' field on the resource ***
        if (resourceSnap.data()?.commentsEnabled === false) {
             console.log(`Comment attempt blocked for resource ${resourceId} (comments disabled).`);
              // *** Adjust error message ***
             return NextResponse.json({ error: "Chat/Comments are disabled for this resource" }, { status: 403 });
        }

        // 3. Parse Request Body (Identical)
        const body = await request.json();
        const { text, parentId } = body;

        // 4. Validate Input (Identical)
        if (!text || typeof text !== 'string' || text.trim() === '') { return NextResponse.json({ error: "Message text cannot be empty" }, { status: 400 }); }
        if (parentId !== undefined && parentId !== null && typeof parentId !== 'string') { return NextResponse.json({ error: "Invalid parentId format (must be string or null)" }, { status: 400 }); }

        // 5. Prepare Comment Data (Use ResourceComment type)
        const newMessageData: Omit<ResourceComment, 'id' | 'createdAt'> = { // *** Use ResourceComment type ***
            parentId: parentId || null,
            authorId: uid, authorName: userName, authorPhotoURL: userPhoto,
            text: text.trim(),
            // Remove updateId if not part of ResourceComment type
        };

        // 6. Add Message to Subcollection (Identical logic, different path)
        // *** Point to 'comments' subcollection under 'resources' ***
        const commentsCollectionRef = resourceRef.collection('comments');
        const docRef = await commentsCollectionRef.add({ ...newMessageData, createdAt: FieldValue.serverTimestamp() });
        console.log(`Comment ${docRef.id} added to resource ${resourceId} by ${uid}. Parent: ${parentId || 'None'}`);

        // 7. Fetch the newly created comment to return its full data (Identical logic)
        const newMessageSnap = await docRef.get();
        const createdCommentData = newMessageSnap.data();
        if (!createdCommentData) { throw new Error("Failed to retrieve created comment data immediately after saving."); }

        // Construct the response object matching the ResourceComment type
         const createdComment: ResourceComment = { // *** Use ResourceComment type ***
             id: newMessageSnap.id,
             parentId: createdCommentData.parentId || null,
             authorId: createdCommentData.authorId,
             authorName: createdCommentData.authorName,
             authorPhotoURL: createdCommentData.authorPhotoURL,
             text: createdCommentData.text,
             createdAt: createdCommentData.createdAt?.toDate ? createdCommentData.createdAt.toDate().toISOString() : new Date().toISOString(),
              // Remove updateId if not part of ResourceComment type
         };

        // 8. Return Success Response (Identical format)
        return NextResponse.json( { message: "Message posted successfully", comment: createdComment }, { status: 201 });

    } catch (error: any) {
        console.error(`❌ POST /comments Error for resource ${params?.resourceId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
         // *** Adjust error message ***
        return NextResponse.json({ error: "Failed to post resource message", details: errorMessage }, { status: 500 });
    }
}