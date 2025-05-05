// app/api/learning-classrooms/[classroomId]/learning-entries/[entryId]/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin';
import { StudentLearningEntry } from '@/lib/types/learning'; // Import StudentLearningEntry type
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// GET /api/learning-classrooms/{classroomId}/learning-entries/{entryId}
// Fetches a single learning entry.
export async function GET(request: Request, { params }: { params: { classroomId: string, entryId: string } }) {
    const { classroomId, entryId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/learning-entries/${entryId}`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET single entry:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce student owner OR teacher member)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("GET single entry: No token provided (unauthenticated).");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let userId = null;
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            console.log(`Authenticated user ${userId} fetching entry ${entryId} in classroom ${classroomId}`);
        } catch (error) {
            console.warn('Invalid ID token for GET single entry:', (error as Error).message);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

         if (!firestore) {
             console.error("Firestore not initialized for GET single entry:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Fetch the single document
        // Security rules will enforce that the user is the student owner OR a teacher member.
        const entryDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('learningEntries').doc(entryId);

        const entryDocSnap = await entryDocRef.get();

        if (!entryDocSnap.exists) {
             console.warn(`Learning entry ${entryId} not found in classroom ${classroomId}.`);
             // Return 404 Not Found if the document doesn't exist
            return NextResponse.json({ message: 'Learning entry not found.' }, { status: 404 });
        }

        const data = entryDocSnap.data();

        // 3. Process Result
        const learningEntry: StudentLearningEntry = {
            id: entryDocSnap.id,
            classroomId: classroomId, // Add classroomId from path
            studentId: data?.studentId,
            title: data?.title || 'Untitled Entry',
            entryDate: timestampToISO(data?.entryDate),
            weekNumber: data?.weekNumber,
            learningType: data?.learningType,
            tasksPerformed: data?.tasksPerformed || '',
            planning: data?.planning || '',
            nextSteps: data?.nextSteps || '',
            challenges: data?.challenges || '',
            learning: data?.learning || '',
            durationHours: data?.durationHours,
            links: Array.isArray(data?.links) ? data.links : [],
            reportFileMetadata: data?.reportFileMetadata,
            presentationFileMetadata: data?.presentationFileMetadata,
            certificateFileMetadata: data?.certificateFileMetadata,
            reportFileUrl: data?.reportFileUrl, // Include future URL placeholder
            presentationFileUrl: data?.presentationFileUrl, // Include future URL placeholder
            certificateFileUrl: data?.certificateFileUrl, // Include future URL placeholder
            customFieldsData: data?.customFieldsData || {},
            isSubmitted: data?.isSubmitted ?? false,
            submissionDate: timestampToISO(data?.submissionDate),
            createdAt: timestampToISO(data?.createdAt),
            updatedAt: timestampToISO(data?.updatedAt),
        } as StudentLearningEntry; // Cast to ensure type safety

        console.log(`Successfully fetched learning entry ${entryId}.`);

        // 4. Return Response
        return NextResponse.json({ entry: learningEntry }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching learning entry ${entryId} for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// PATCH /api/learning-classrooms/{classroomId}/learning-entries/{entryId}
// Updates a single learning entry.
export async function PATCH(request: Request, { params }: { params: { classroomId: string, entryId: string } }) {
    const { classroomId, entryId } = params;
    console.log(`PATCH /api/learning-classrooms/${classroomId}/learning-entries/${entryId}`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for PATCH single entry:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce student owner)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("PATCH single entry: No token provided.");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for PATCH single entry:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        console.log(`Authenticated user ${userId} attempting to update entry ${entryId} in classroom ${classroomId}`);

        // NOTE: Security rules already enforce that:
        // 1. The user is authenticated.
        // 2. The user is the student owner of the entry.
        // 3. Immutable fields are not changed.
        // 4. Only allowed mutable fields are updated (via keys().hasOnly()).
        // 5. updatedAt uses server timestamp.
        // The API only needs to ensure the data structure matches what the rules expect for mutable fields.

        // 2. Validate Request Body
        // Get the fields that the client is attempting to update
        const updates = await request.json();

        // Basic validation (more detailed validation is in security rules)
        // You might check if the provided fields are actually in the allowed list if you don't fully trust the client payload.
        // However, Security Rules are the primary enforcement mechanism for which fields can change.
        // Ensure complex types like 'links' and 'customFieldsData' are handled correctly if being updated.

        // Example: If 'links' is being updated, ensure it's an array
        if (updates.links !== undefined && !Array.isArray(updates.links)) {
            console.warn("Bad Request: Invalid links format for update.");
            return NextResponse.json({ message: 'Bad Request: Links must be an array.' }, { status: 400 });
        }
        // Example: If 'customFieldsData' is being updated, ensure it's an object/map
         if (updates.customFieldsData !== undefined && (typeof updates.customFieldsData !== 'object' || updates.customFieldsData === null || Array.isArray(updates.customFieldsData))) {
            console.warn("Bad Request: Invalid customFieldsData format for update.");
            return NextResponse.json({ message: 'Bad Request: Custom fields data must be an object.' }, { status: 400 });
         }
         // Example: If dates like entryDate or submissionDate are updated, ensure they are valid date strings/timestamps
         if (updates.entryDate !== undefined && (typeof updates.entryDate !== 'string' || isNaN(new Date(updates.entryDate).getTime()))) {
              console.warn("Bad Request: Invalid entryDate format for update.");
              return NextResponse.json({ message: 'Bad Request: Invalid entry date format.' }, { status: 400 });
         }
          if (updates.submissionDate !== undefined && updates.submissionDate !== null && (typeof updates.submissionDate !== 'string' || isNaN(new Date(updates.submissionDate).getTime()))) {
              console.warn("Bad Request: Invalid submissionDate format for update.");
              return NextResponse.json({ message: 'Bad Request: Invalid submission date format.' }, { status: 400 });
         }


        // 3. Prepare Update Data
        const now = Timestamp.now();
        const updateData: { [key: string]: any } = {
            updatedAt: now, // Always update server timestamp on PATCH
        };

        // Add only the mutable fields received in the request to the updateData
        // Security Rules will verify which fields are actually allowed to change.
        // We need to handle date conversions if dates are being updated.
        for (const field in updates) {
            if (field !== 'updatedAt') { // Don't allow client to set updatedAt
                if (field === 'entryDate' && updates.entryDate !== undefined) {
                     // Convert entryDate string to Timestamp if provided
                     updateData.entryDate = Timestamp.fromDate(new Date(updates.entryDate));
                } else if (field === 'submissionDate' && updates.submissionDate !== undefined) {
                     // Convert submissionDate string to Timestamp if provided (handle null)
                     updateData.submissionDate = updates.submissionDate === null ? null : Timestamp.fromDate(new Date(updates.submissionDate));
                }
                 else if (field === 'links' && updates.links !== undefined) {
                     // Ensure links is stored as array
                     updateData.links = Array.isArray(updates.links) ? updates.links : []; // Sanitize to array
                 }
                  else if (field === 'customFieldsData' && updates.customFieldsData !== undefined) {
                     // Ensure customFieldsData is stored as map/object
                      updateData.customFieldsData = (typeof updates.customFieldsData === 'object' && updates.customFieldsData !== null && !Array.isArray(updates.customFieldsData)) ? updates.customFieldsData : {}; // Sanitize to object
                  }
                 // TODO: Add specific handling for fileMetadata fields if they are being *updated* via PATCH.
                 // Currently, the PATCH rule allows updating fileMetadata fields, so you might receive them here.
                 // You'd likely just store the metadata again.
                 else if (field === 'reportFileMetadata' || field === 'presentationFileMetadata' || field === 'certificateFileMetadata') {
                      updateData[field] = updates[field] || undefined; // Store metadata or undefined if null/empty
                 }
                  // Handle future URL updates (teacher action?) - Policy decision needed
                 else if (field === 'reportFileUrl' || field === 'presentationFileUrl' || field === 'certificateFileUrl') {
                      updateData[field] = updates[field] || null; // Store URL or null
                 }
                else {
                    // For all other fields allowed by rules, just pass the value
                    updateData[field] = updates[field];
                }
            }
        }

        // Ensure there's something to update besides updatedAt
        if (Object.keys(updateData).length <= 1 && updateData.updatedAt) {
             console.warn("PATCH single entry: No valid fields provided for update.");
            return NextResponse.json({ message: 'Bad Request: No valid fields provided for update.' }, { status: 400 });
        }

        // 4. Update Document in Firestore
         if (!firestore) {
             console.error("Firestore not initialized for PATCH single entry:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Updating learning entry ${entryId} in classroom ${classroomId} with:`, updateData);

        const entryDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('learningEntries').doc(entryId);

        // Perform the update operation
        await entryDocRef.update(updateData);

        console.log(`✅ Learning entry ${entryId} updated successfully.`);

        // 5. Return Success Response
        return NextResponse.json({ message: 'Learning entry updated successfully' }, { status: 200 }); // 200 OK

    } catch (error) {
        console.error(`❌ Error updating learning entry ${entryId} for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// DELETE /api/learning-classrooms/{classroomId}/learning-entries/{entryId}
// Deletes a single learning entry.
export async function DELETE(request: Request, { params }: { params: { classroomId: string, entryId: string } }) {
    const { classroomId, entryId } = params;
    console.log(`DELETE /api/learning-classrooms/${classroomId}/learning-entries/${entryId}`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for DELETE single entry:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce student owner)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("DELETE single entry: No token provided.");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for DELETE single entry:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        console.log(`Authenticated user ${userId} attempting to delete entry ${entryId} in classroom ${classroomId}`);

        // NOTE: Security rules already enforce that:
        // 1. The user is authenticated.
        // 2. The user is the student owner of the entry.
        // Or potentially a teacher member if you added that to the rule.

        // 2. Delete the document
         if (!firestore) {
             console.error("Firestore not initialized for DELETE single entry:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Deleting learning entry ${entryId} from classroom ${classroomId}...`);

        const entryDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('learningEntries').doc(entryId);

        // Perform the delete operation
        await entryDocRef.delete();

        console.log(`✅ Learning entry ${entryId} deleted successfully.`);

        // 3. Return Success Response
        return NextResponse.json({ message: 'Learning entry deleted successfully' }, { status: 200 }); // 200 OK

    } catch (error) {
        console.error(`❌ Error deleting learning entry ${entryId} for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}