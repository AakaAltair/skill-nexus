// app/api/placement/drives/[driveId]/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin'; // Adjust path if needed
import { Timestamp, FieldValue, Query } from 'firebase-admin/firestore';
import { PlacementComment } from '@/lib/types/placement'; // Adjust path if needed

// --- GET Handler: Fetch ALL Comments for a Placement Drive ---
export async function GET(
    request: NextRequest,
    // Destructure driveId from params based on folder structure
    { params }: { params: { driveId: string } }
) {
    const driveId = params.driveId;
    console.log(`--- GET /api/placement/drives/${driveId}/comments ---`);
    try {
        if (!firestore) { throw new Error("Firestore not initialized."); }
        if (!driveId) { return NextResponse.json({ error: "Placement Drive ID missing" }, { status: 400 }); }

        // Reference the 'comments' subcollection under the specific drive
        const commentsCollectionRef = firestore
            .collection('placementDrives').doc(driveId) // Go to specific drive doc
            .collection('comments');                  // Access its comments subcollection

        // Fetch all comments, ordered by creation time (ascending for chat flow)
        // Consider adding a limit if the number of comments could be very large
        const queryRef = commentsCollectionRef.orderBy('createdAt', 'asc').limit(250); // Example limit
        const querySnapshot = await queryRef.get();

        // Map Firestore documents to PlacementComment type
        const comments = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const commentData: Omit<PlacementComment, 'id'> & {id: string} = {
                id: doc.id,
                parentId: data.parentId || null,
                authorId: data.authorId || '',
                authorName: data.authorName || 'Anonymous',
                authorPhotoURL: data.authorPhotoURL || '/default-avatar.png',
                text: data.text || '',
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
            return commentData as PlacementComment; // Assert type
        });

        console.log(`Found ${comments.length} comments for drive ${driveId}.`);
        // Return comments array wrapped in an object
        return NextResponse.json({ comments });

    } catch (error: any) {
        console.error(`❌ GET /comments Error for drive ${driveId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json({ error: "Failed to fetch drive comments", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create a New Comment/Reply for a Placement Drive ---
export async function POST(
    request: NextRequest,
    { params }: { params: { driveId: string } }
) {
    const driveId = params.driveId;
    console.log(`--- POST /api/placement/drives/${driveId}/comments ---`);
    try {
        if (!firestore || !adminAuth) { throw new Error("Firestore or Admin Auth not initialized."); }
        if (!driveId) { return NextResponse.json({ error: "Placement Drive ID missing" }, { status: 400 }); }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) { return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 }); }

        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); }
        catch (authError: any) { return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 }); }
        const uid = decodedToken.uid;
        const userName = decodedToken.name || "Anonymous"; // Use token name
        const userPhoto = decodedToken.picture || "/default-avatar.png"; // Use token picture

        // 2. Check Parent Drive Exists & Comments Enabled
        const driveRef = firestore.collection('placementDrives').doc(driveId);
        const driveSnap = await driveRef.get();
        if (!driveSnap.exists) { return NextResponse.json({ error: "Placement drive not found" }, { status: 404 }); }
        // Check 'commentsEnabled' field (default to true if missing/null)
        if (driveSnap.data()?.commentsEnabled === false) {
             console.log(`Comment attempt blocked for drive ${driveId} (comments disabled).`);
             return NextResponse.json({ error: "Comments/Q&A are disabled for this drive" }, { status: 403 });
        }

        // 3. Parse Request Body
        const body = await request.json();
        const { text, parentId } = body; // Expect text and optional parentId

        // 4. Validate Input
        if (!text || typeof text !== 'string' || text.trim() === '') {
            return NextResponse.json({ error: "Comment text cannot be empty" }, { status: 400 });
        }
        if (parentId !== undefined && parentId !== null && typeof parentId !== 'string') {
             return NextResponse.json({ error: "Invalid parentId format" }, { status: 400 });
        }
        // Optional: Validate parentId exists in the subcollection?

        // 5. Prepare Comment Data
        const newCommentData: Omit<PlacementComment, 'id' | 'createdAt'> = {
            parentId: parentId || null, // Store null if it's a top-level comment
            authorId: uid, // ID of the user posting
            authorName: userName, // Denormalized name
            authorPhotoURL: userPhoto, // Denormalized photo
            text: text.trim(), // Trimmed comment text
        };

        // 6. Add Comment to Subcollection
        const commentsCollectionRef = driveRef.collection('comments');
        const docRef = await commentsCollectionRef.add({
            ...newCommentData,
            createdAt: FieldValue.serverTimestamp(), // Use server timestamp
        });
        console.log(`Comment ${docRef.id} added to drive ${driveId} by ${uid}. Parent: ${parentId || 'None'}`);

        // 7. Fetch the newly created comment to return its full data
        const newCommentSnap = await docRef.get();
        const createdCommentData = newCommentSnap.data();
        if (!createdCommentData) { throw new Error("Failed to retrieve created comment data."); }

        // Construct the response object matching PlacementComment type
         const createdComment: PlacementComment = {
             id: newCommentSnap.id,
             parentId: createdCommentData.parentId || null,
             authorId: createdCommentData.authorId,
             authorName: createdCommentData.authorName,
             authorPhotoURL: createdCommentData.authorPhotoURL,
             text: createdCommentData.text,
             // Convert timestamp before sending back
             createdAt: createdCommentData.createdAt?.toDate ? createdCommentData.createdAt.toDate().toISOString() : new Date().toISOString(),
         };

        // 8. Return Success Response with the created comment data
        return NextResponse.json(
             { message: "Comment posted successfully", comment: createdComment },
             { status: 201 } // HTTP 201 Created
        );

    } catch (error: any) {
        console.error(`❌ POST /comments Error for drive ${driveId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json({ error: "Failed to post comment", details: errorMessage }, { status: 500 });
    }
}