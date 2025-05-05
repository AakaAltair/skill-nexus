// CORRECT LOCATION: app/api/projects/[projectId]/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Your initialized admin instances
import { Timestamp, FieldValue, Query } from 'firebase-admin/firestore'; // Import necessary types/helpers
import { Comment } from '@/lib/types/project'; // Import Comment type

// --- GET Handler: Fetch ALL Comments for a Project ---
export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    // Log safely using optional chaining on params at the start
    console.log(`--- GET /api/projects/${params?.projectId || 'undefined'}/comments (Fetching ALL for chat) ---`);
    try {
        // Access and validate projectId inside the try block
        const projectId = params.projectId;
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
             return NextResponse.json({ error: "Project ID missing or invalid" }, { status: 400 });
        }

        if (!firestore) {
            throw new Error("Firestore not initialized.");
        }

        const commentsCollectionRef = firestore
            .collection('projects').doc(projectId)
            .collection('comments'); // Reference the subcollection

        // Query ALL comments for the project, ordered by creation time (for chat)
        // Fetch a reasonable limit, implement pagination later if needed
        const queryRef = commentsCollectionRef.orderBy('createdAt', 'asc').limit(200); // Adjust limit as needed
        const querySnapshot = await queryRef.get(); // Use Admin SDK .get()

        // Map Firestore documents to Comment type
        const comments = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const commentData: Omit<Comment, 'id'> & {id: string} = {
                id: doc.id,
                // Include fields even if potentially null/undefined from DB
                updateId: data.updateId || null, // Keep for type consistency, though we ignore it
                parentId: data.parentId || null, // Crucial for nesting
                authorId: data.authorId || '',
                authorName: data.authorName || 'Anonymous',
                authorPhotoURL: data.authorPhotoURL || '',
                text: data.text || '',
                 // Convert Timestamp to ISO string
                 createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
            return commentData as Comment; // Assert type
        });

        console.log(`Found ${comments.length} comments for project ${projectId}.`);
        return NextResponse.json({ comments }); // Return the flat list

    } catch (error: any) {
        console.error(`❌ GET /comments Error for project ${params?.projectId}:`, error);
         const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json({ error: "Failed to fetch comments", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create a New Chat Message (Comment or Reply) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    // Log safely first
    console.log(`--- POST /api/projects/${params?.projectId || 'undefined'}/comments (New Chat Message/Reply) ---`);
    try {
        // Access and validate projectId INSIDE try block
        const projectId = params.projectId;
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
             return NextResponse.json({ error: "Project ID missing or invalid" }, { status: 400 });
        }

        if (!firestore || !adminAuth) {
             throw new Error("Firestore or Admin Auth not initialized.");
        }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
             return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
        }

        let decodedToken;
        try {
             decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ Token verification failed:", authError);
             return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid;
        const userName = decodedToken.name || "Anonymous";
        const userPhoto = decodedToken.picture || ""; // Default if no picture in token

        // 2. Check Project Exists & Chat/Comments Enabled
        const projectRef = firestore.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();
        if (!projectSnap.exists) {
             return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        // Default to true if field is missing/undefined, block only if explicitly false
        if (projectSnap.data()?.commentsEnabled === false) {
             console.log(`Comment attempt blocked for project ${projectId} (comments disabled).`);
             return NextResponse.json({ error: "Chat/Comments are disabled for this project" }, { status: 403 });
        }

        // 3. Parse Request Body
        const body = await request.json();
        // Expect 'text' (required) and 'parentId' (optional, string or null)
        const { text, parentId } = body;

        // 4. Validate Input
        if (!text || typeof text !== 'string' || text.trim() === '') {
            return NextResponse.json({ error: "Message text cannot be empty" }, { status: 400 });
        }
        // Validate parentId format if provided (must be string or null/undefined)
        if (parentId !== undefined && parentId !== null && typeof parentId !== 'string') {
             return NextResponse.json({ error: "Invalid parentId format (must be string or null)" }, { status: 400 });
        }
        // Optional: Check if parentId comment actually exists? Adds complexity.

        // 5. Prepare Comment Data
        const newMessageData: Omit<Comment, 'id' | 'createdAt' | 'updateId'> = {
            parentId: parentId || null, // Save null if parentId is missing/falsy
            authorId: uid,
            authorName: userName,
            authorPhotoURL: userPhoto,
            text: text.trim(),
            // updateId should be null or omitted as it's not relevant for global chat
            updateId: null, // Explicitly set to null
        };

        // 6. Add Message to Subcollection
        const commentsCollectionRef = projectRef.collection('comments'); // Use 'comments' subcollection
        const docRef = await commentsCollectionRef.add({
            ...newMessageData,
            createdAt: FieldValue.serverTimestamp(), // Use server timestamp
        });

        console.log(`Comment ${docRef.id} added to project ${projectId} by ${uid}. Parent: ${parentId || 'None'}`);

        // 7. Fetch the newly created comment to return its full data
        const newMessageSnap = await docRef.get();
        const createdCommentData = newMessageSnap.data();
        if (!createdCommentData) {
             throw new Error("Failed to retrieve created comment data immediately after saving.");
        }

        // Construct the response object matching the Comment type
         const createdComment: Comment = {
             id: newMessageSnap.id,
             updateId: createdCommentData.updateId || null, // Ensure it exists for type
             parentId: createdCommentData.parentId || null,
             authorId: createdCommentData.authorId,
             authorName: createdCommentData.authorName,
             authorPhotoURL: createdCommentData.authorPhotoURL,
             text: createdCommentData.text,
             createdAt: createdCommentData.createdAt?.toDate ? createdCommentData.createdAt.toDate().toISOString() : new Date().toISOString(), // Convert timestamp
         };

        // 8. Return Success Response
        return NextResponse.json(
             { message: "Message posted successfully", comment: createdComment }, // Return the created comment
             { status: 201 }
        );

    } catch (error: any) {
        console.error(`❌ POST /comments Error for project ${params?.projectId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json({ error: "Failed to post message", details: errorMessage }, { status: 500 });
    }
}