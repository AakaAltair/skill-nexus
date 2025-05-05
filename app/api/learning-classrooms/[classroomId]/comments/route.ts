// app/api/learning-classrooms/[classroomId]/comments/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin';
import { ClassroomComment } from '@/lib/types/learning'; // Import ClassroomComment type
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// GET /api/learning-classrooms/{classroomId}/comments
// Fetches comments for a specific classroom.
export async function GET(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/comments`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET comments:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required for reading this subcollection via rules)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("GET comments: No token provided (unauthenticated).");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let userId = null;
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            console.log(`Authenticated user ${userId} fetching comments for ${classroomId}`);
        } catch (error) {
            console.warn('Invalid ID token for GET comments:', (error as Error).message);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

         if (!firestore) {
             console.error("Firestore not initialized for GET comments:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Query Firestore Subcollection
        // Security rules will enforce that the user is a member of the parent classroom.
        // Ordering by createdAt ascending for chat-like display
        const commentsSnapshot = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('comments')
                                                    .orderBy('createdAt', 'asc') // Oldest first for chat flow
                                                    .get();

        // 3. Process Results
        const comments: ClassroomComment[] = commentsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                classroomId: classroomId, // Add classroomId from path
                parentId: data.parentId || null, // Include parentId, default to null
                streamItemId: data.streamItemId || null, // Include streamItemId, default to null
                text: data.text || '',
                postedById: data.postedById,
                postedByName: data.postedByName || 'Unknown',
                postedByPhotoURL: data.postedByPhotoURL,
                createdAt: timestampToISO(data.createdAt),
                updatedAt: timestampToISO(data.updatedAt),
            } as ClassroomComment;
        });

        console.log(`Found ${comments.length} comments for classroom ${classroomId}.`);

        // 4. Return Response
        return NextResponse.json({ comments }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching comments for classroom ${classroomId}:`, error);
        return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
    }
}


// POST /api/learning-classrooms/{classroomId}/comments
// Creates a new comment for a classroom (top-level or reply).
export async function POST(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`POST /api/learning-classrooms/${classroomId}/comments`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST comments:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce membership and commentsEnabled)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("POST comments: No token provided.");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for POST comments:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const userName = decodedToken.name || 'Anonymous'; // Get name from token
        const userPhotoURL = decodedToken.picture || null; // Get photo URL from token


        // NOTE: Membership check and commentsEnabled check are handled by Firestore Security Rules.
        // The API only needs to ensure the user is authenticated and the data is valid.

        // 2. Validate Request Body
        const data = await request.json();

        const text = data.text;
        const parentId = data.parentId || null; // Expect parentId or null
        const streamItemId = data.streamItemId || null; // Expect streamItemId or null

        if (typeof text !== 'string' || text.trim().length === 0) {
             console.warn("Bad Request: Invalid or empty text content.");
            return NextResponse.json({ message: 'Bad Request: Comment text cannot be empty.' }, { status: 400 });
        }
        // Optional: Validate parentId and streamItemId format if they are provided


        // 3. Prepare Comment Document
        const now = Timestamp.now();
        const newCommentData = {
            classroomId: classroomId, // Ensure classroomId is included in the document
            parentId: parentId, // Store parentId (null for top-level)
            streamItemId: streamItemId, // Store streamItemId (null if not linked)
            text: text.trim(),
            postedById: userId,
            postedByName: userName,
            postedByPhotoURL: userPhotoURL,
            createdAt: now,
            updatedAt: now,
        };

        // 4. Save Document to Firestore Subcollection
         if (!firestore) {
             console.error("Firestore not initialized for POST comments:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Saving new comment for classroom ${classroomId}...`, newCommentData);

        // Add the document to the comments subcollection of the specific classroom document
        const docRef = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('comments')
                                                    .add(newCommentData);

        console.log(`✅ Comment created successfully with ID: ${docRef.id} in classroom ${classroomId}.`);

        // 5. Return Success Response
        // Include the new comment ID in the response
        return NextResponse.json({ message: 'Comment posted successfully', commentId: docRef.id }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error(`❌ Error creating comment for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// No PATCH or DELETE handlers needed yet for comments