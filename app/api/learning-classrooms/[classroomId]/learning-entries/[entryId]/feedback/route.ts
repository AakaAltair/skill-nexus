// app/api/learning-classrooms/[classroomId]/learning-entries/[entryId]/feedback/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin';
import { LearningEntryFeedback } from '@/lib/types/learning'; // Import type
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// GET /api/learning-classrooms/{classroomId}/learning-entries/{entryId}/feedback
// Fetches feedback for a specific learning entry.
export async function GET(request: Request, { params }: { params: { classroomId: string, entryId: string } }) {
    const { classroomId, entryId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET feedback:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce student owner OR teacher member)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("GET feedback: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for GET feedback:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        // User is authenticated. Security rules ensure they can read this feedback.

         if (!firestore) {
             console.error("Firestore not initialized for GET feedback:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Query Firestore Subcollection
        // Security rules will enforce who can read this subcollection.
        const feedbackSnapshot = await firestore.collection('learningClassrooms').doc(classroomId)
                                                  .collection('learningEntries').doc(entryId)
                                                  .collection('feedback')
                                                  .orderBy('createdAt', 'asc') // Order by creation date
                                                  .get();

        // 3. Process Results
        const feedbackItems: LearningEntryFeedback[] = feedbackSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                classroomId: classroomId,
                entryId: entryId,
                teacherId: data.teacherId,
                teacherName: data.teacherName || 'Teacher',
                feedbackText: data.feedbackText || '',
                grade: data.grade, // Keep as is (string or number)
                createdAt: timestampToISO(data.createdAt),
                updatedAt: timestampToISO(data.updatedAt),
            } as LearningEntryFeedback;
        });

        console.log(`Found ${feedbackItems.length} feedback items for entry ${entryId}.`);

        // 4. Return Response
        return NextResponse.json({ feedback: feedbackItems }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching feedback for entry ${entryId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// POST /api/learning-classrooms/{classroomId}/learning-entries/{entryId}/feedback
// Creates a new feedback item (Teacher only via Security Rules).
export async function POST(request: Request, { params }: { params: { classroomId: string, entryId: string } }) {
    const { classroomId, entryId } = params;
    console.log(`POST /api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST feedback:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher role)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("POST feedback: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for POST feedback:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }

        const userId = decodedToken.uid;
        const userName = decodedToken.name || 'Anonymous'; // Get name from token
        // Optional: get photo URL from token if storing with feedback
        // const userPhotoURL = decodedToken.picture || null;

        // 2. Validate Request Body
        const data = await request.json();
        const { feedbackText, grade } = data;

        // Basic validation (more extensive validation in Security Rules)
        if (typeof feedbackText !== 'string' || feedbackText.trim().length === 0) { return NextResponse.json({ message: 'Bad Request: feedbackText is required.' }, { status: 400 }); }
        // Optional validation for grade type/format if necessary

        // 3. Prepare Document Data
        const now = Timestamp.now();
        const newFeedbackData = {
            classroomId: classroomId, // Include IDs from path
            entryId: entryId,
            teacherId: userId, // Store the teacher's UID
            teacherName: userName, // Store the teacher's name
            feedbackText: feedbackText.trim(),
            grade: grade, // Store grade as is
            createdAt: now,
            updatedAt: now,
        };

        // 4. Save Document to Firestore Subcollection
         if (!firestore) {
             console.error("Firestore not initialized for POST feedback:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Saving new feedback for entry ${entryId} in classroom ${classroomId} by teacher ${userId}...`);

        const docRef = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('learningEntries').doc(entryId)
                                                    .collection('feedback')
                                                    .add(newFeedbackData);

        console.log(`✅ Feedback created successfully with ID: ${docRef.id} for entry ${entryId}.`);

        // 5. Return Success Response
        return NextResponse.json({ message: 'Feedback posted successfully', feedbackId: docRef.id }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error(`❌ Error creating feedback for entry ${entryId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

