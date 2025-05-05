// app/api/learning-classrooms/[classroomId]/streamItems/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin';
import { ClassroomStreamItem, Attachment } from '@/lib/types/learning'; // Import necessary types
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// GET /api/learning-classrooms/{classroomId}/streamItems
// Fetches stream items for a specific classroom.
export async function GET(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/streamItems`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET streamItems:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required for reading this subcollection via rules)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("GET streamItems: No token provided (unauthenticated).");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let userId = null;
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            console.log(`Authenticated user ${userId} fetching stream items for ${classroomId}`);
        } catch (error) {
            console.warn('Invalid ID token for GET streamItems:', (error as Error).message);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

         if (!firestore) {
             console.error("Firestore not initialized for GET streamItems:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }


        // 2. Query Firestore Subcollection
        // Security rules will enforce that the user is a member of the parent classroom.
        const streamItemsSnapshot = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('streamItems')
                                                    .orderBy('createdAt', 'desc') // Newest first for stream feed
                                                    .get();

        // 3. Process Results
        const streamItems: ClassroomStreamItem[] = streamItemsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                classroomId: classroomId, // Add classroomId from path
                type: data.type || 'announcement', // Default type
                content: data.content || '',
                attachments: Array.isArray(data.attachments) ? data.attachments : [], // Ensure attachments is an array
                postedById: data.postedById,
                postedByName: data.postedByName || 'Unknown',
                postedByPhotoURL: data.postedByPhotoURL,
                createdAt: timestampToISO(data.createdAt),
                updatedAt: timestampToISO(data.updatedAt),
            } as ClassroomStreamItem;
        });

        console.log(`Found ${streamItems.length} stream items for classroom ${classroomId}.`);

        // 4. Return Response
        return NextResponse.json({ streamItems }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching stream items for classroom ${classroomId}:`, error);
        // Provide a generic error message to the client
        return NextResponse.json({ message: 'Internal Server Error', error: (error as Error).message }, { status: 500 });
    }
}


// POST /api/learning-classrooms/{classroomId}/streamItems
// Creates a new stream item (announcement, material, etc.) for a classroom.
export async function POST(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`POST /api/learning-classrooms/${classroomId}/streamItems`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST streamItems:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher role)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("POST streamItems: No token provided.");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for POST streamItems:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const userName = decodedToken.name || 'Anonymous'; // Get name from token
        const userPhotoURL = decodedToken.picture || null; // Get photo URL from token


        // NOTE: Teacher role check is handled by Firestore Security Rules for this path.
        // The API only needs to ensure the user is authenticated and the data is valid.

        // 2. Validate Request Body
        const data = await request.json();

        // Ensure content is a string and attachments is an optional array
        const content = data.content;
        const attachments = data.attachments; // This will be the array of { name, url, type, fileMetadata }

        if (typeof content !== 'string') {
             console.warn("Bad Request: Invalid content type.");
            return NextResponse.json({ message: 'Bad Request: Content must be a string.' }, { status: 400 });
        }
        if (attachments !== undefined && !Array.isArray(attachments)) {
             console.warn("Bad Request: Attachments must be an array if provided.");
            return NextResponse.json({ message: 'Bad Request: Attachments must be an array.' }, { status: 400 });
        }

         // If no content and no attachments, reject
        if (content.trim().length === 0 && (!attachments || attachments.length === 0)) {
             console.warn("Bad Request: Cannot post empty update with no attachments.");
            return NextResponse.json({ message: 'Bad Request: Update must contain content or attachments.' }, { status: 400 });
        }

        // Process attachments: store metadata for 'local:' files, store others as is
        const processedAttachments = Array.isArray(attachments) ? attachments.map((att: Attachment) => {
             // If it's a temporary file placeholder from the frontend
            if (att.url?.startsWith('local:') && att.fileMetadata) {
                 // Save only the name, type, and fileMetadata to Firestore for now
                 // The actual file upload happens separately (TODO)
                return {
                     name: att.name,
                     type: att.type,
                     fileMetadata: att.fileMetadata, // Store size, type
                     // Do NOT store the 'local:' URL or actual file content
                     url: null, // Explicitly set URL to null for now
                 };
            }
             // For links or future actual file URLs, save as is
            return {
                 name: att.name,
                 url: att.url,
                 type: att.type,
                 // Don't include fileMetadata if it's not a temp file
                 fileMetadata: undefined,
            };
        }) : [];


        // 3. Prepare Stream Item Document
        const now = Timestamp.now();
        const newStreamItemData = {
            classroomId: classroomId, // Ensure classroomId is included in the document
            type: data.type || 'announcement', // Allow type to be specified, default to 'announcement'
            content: content.trim(),
            attachments: processedAttachments, // Save processed attachments
            postedById: userId,
            postedByName: userName,
            postedByPhotoURL: userPhotoURL,
            createdAt: now,
            updatedAt: now,
        };

        // 4. Save Document to Firestore Subcollection
         if (!firestore) {
             console.error("Firestore not initialized for POST streamItems:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Saving new stream item for classroom ${classroomId}...`, newStreamItemData);

        // Add the document to the streamItems subcollection of the specific classroom document
        const docRef = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('streamItems')
                                                    .add(newStreamItemData);

        console.log(`✅ Stream item created successfully with ID: ${docRef.id} in classroom ${classroomId}.`);

        // 5. Return Success Response
        return NextResponse.json({ message: 'Stream item posted successfully', streamItemId: docRef.id }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error(`❌ Error creating stream item for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// No PATCH or DELETE handlers needed yet for stream items