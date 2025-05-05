// app/api/learning-classrooms/[classroomId]/learning-entries/[entryId]/feedback/[feedbackId]/route.ts

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


// GET /api/learning-classrooms/{classroomId}/learning-entries/{entryId}/feedback/{feedbackId}
// Fetches a single feedback item (Teacher or Student Owner of Entry via Rules).
export async function GET(request: Request, { params }: { params: { classroomId: string, entryId: string, feedbackId: string } }) {
    const { classroomId, entryId, feedbackId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback/${feedbackId}`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET single feedback:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce student owner OR teacher member)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("GET single feedback: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for GET single feedback:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        // User is authenticated. Security rules ensure they can read this feedback.

         if (!firestore) {
             console.error("Firestore not initialized for GET single feedback:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Fetch the single document
        const feedbackDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('learningEntries').doc(entryId)
                                        .collection('feedback').doc(feedbackId);
        const feedbackDocSnap = await feedbackDocRef.get();

        if (!feedbackDocSnap.exists) {
             console.warn(`Feedback item ${feedbackId} not found for entry ${entryId} in classroom ${classroomId}.`);
            return NextResponse.json({ message: 'Feedback item not found.' }, { status: 404 });
        }

        const data = feedbackDocSnap.data();

        // 3. Process Result
        const feedback: LearningEntryFeedback = {
            id: feedbackDocSnap.id,
            classroomId: classroomId,
            entryId: entryId,
            teacherId: data?.teacherId,
            teacherName: data?.teacherName || 'Teacher',
            feedbackText: data?.feedbackText || '',
            grade: data?.grade,
            createdAt: timestampToISO(data?.createdAt),
            updatedAt: timestampToISO(data?.updatedAt),
        } as LearningEntryFeedback;

        console.log(`Successfully fetched feedback item ${feedbackId}.`);

        // 4. Return Response
        return NextResponse.json({ feedback }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching feedback item ${feedbackId} for entry ${entryId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// PATCH /api/learning-classrooms/{classroomId}/learning-entries/{entryId}/feedback/{feedbackId}
// Updates a single feedback item (Teacher author only via Security Rules).
export async function PATCH(request: Request, { params }: { params: { classroomId: string, entryId: string, feedbackId: string } }) {
    const { classroomId, entryId, feedbackId } = params;
    console.log(`PATCH /api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback/${feedbackId}`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for PATCH single feedback:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher author)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("PATCH single feedback: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for PATCH single feedback:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid; // User ID, security rules do the author check


        // 2. Validate Request Body
        const updates = await request.json();
        // Security rules enforce keys().hasOnly(['feedbackText', 'grade', 'updatedAt'])
        // Basic validation here
        if (updates.feedbackText !== undefined && typeof updates.feedbackText !== 'string') { return NextResponse.json({ message: 'Bad Request: feedbackText must be string.' }, { status: 400 }); }
        // Optional: Validate grade type if needed

        // Ensure at least one allowed field is provided + prevent client setting updatedAt
        const allowedFields = ['feedbackText', 'grade'];
        const hasAllowedUpdate = allowedFields.some(field => updates[field] !== undefined);

        if (!hasAllowedUpdate) {
             console.warn("PATCH single feedback: No valid fields provided for update.");
            return NextResponse.json({ message: 'Bad Request: No valid fields provided for update.' }, { status: 400 });
        }


        // 3. Prepare Update Data
        const now = Timestamp.now();
        const updateData: { [key: string]: any } = {
             updatedAt: now,
        };

        // Add allowed fields if they exist in the updates payload
        if (updates.feedbackText !== undefined) updateData.feedbackText = updates.feedbackText.trim();
        if (updates.grade !== undefined) updateData.grade = updates.grade; // Store grade as is

        // 4. Update Document in Firestore
         if (!firestore) {
             console.error("Firestore not initialized for PATCH single feedback:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Updating feedback item ${feedbackId} with:`, updateData);

        const feedbackDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('learningEntries').doc(entryId)
                                        .collection('feedback').doc(feedbackId);
        await feedbackDocRef.update(updateData);

        console.log(`✅ Feedback item ${feedbackId} updated successfully.`);

        // 5. Return Success Response
        return NextResponse.json({ message: 'Feedback item updated successfully' }, { status: 200 }); // 200 OK

    } catch (error) {
        console.error(`❌ Error updating feedback item ${feedbackId} for entry ${entryId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// DELETE /api/learning-classrooms/{classroomId}/learning-entries/{entryId}/feedback/{feedbackId}
// Deletes a single feedback item (Teacher author or any teacher in classroom via Security Rules).
export async function DELETE(request: Request, { params }: { params: { classroomId: string, entryId: string, feedbackId: string } }) {
    const { classroomId, entryId, feedbackId } = params;
    console.log(`DELETE /api/learning-classrooms/${classroomId}/learning-entries/${entryId}/feedback/${feedbackId}`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for DELETE single feedback:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher author OR any teacher member)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("DELETE single feedback: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for DELETE single feedback:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid; // User ID, security rules do the authorization check


        // 2. Delete the document
         if (!firestore) {
             console.error("Firestore not initialized for DELETE single feedback:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Deleting feedback item ${feedbackId} from entry ${entryId} in classroom ${classroomId}...`);

        const feedbackDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('learningEntries').doc(entryId)
                                        .collection('feedback').doc(feedbackId);
        await feedbackDocRef.delete();

        console.log(`✅ Feedback item ${feedbackId} deleted successfully.`);

        // 3. Return Success Response
        return NextResponse.json({ message: 'Feedback item deleted successfully' }, { status: 200 }); // 200 OK

    } catch (error) {
        console.error(`❌ Error deleting feedback item ${feedbackId} for entry ${entryId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}