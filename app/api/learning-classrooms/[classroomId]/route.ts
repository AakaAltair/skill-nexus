// app/api/learning-classrooms/[classroomId]/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin';
import { LearningClassroom, StudentLearningEntry, UserProfile } from '@/lib/types/learning'; // Import necessary types
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// GET /api/learning-classrooms/{classroomId}
// Fetches a single classroom and includes profiles for all student members.
export async function GET(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET single classroom:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce membership)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("GET single classroom: No token provided (unauthenticated).");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let userId = null;
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            console.log(`Authenticated user ${userId} fetching classroom ${classroomId}`);
        } catch (error) {
            console.warn('Invalid ID token for GET single classroom:', (error as Error).message);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

         if (!firestore) {
             console.error("Firestore not initialized for GET single classroom:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Fetch the single classroom document
        // Security rules will enforce that the user is a member.
        const classroomDocRef = firestore.collection('learningClassrooms').doc(classroomId);
        const classroomDocSnap = await classroomDocRef.get();

        if (!classroomDocSnap.exists) {
             console.warn(`Learning classroom ${classroomId} not found.`);
             // Return 404 Not Found if the document doesn't exist or user is not a member (due to rules)
            return NextResponse.json({ message: 'Learning page not found or you do not have access.' }, { status: 404 });
        }

        const classroomData = classroomDocSnap.data();

        // 3. Process Classroom Data
        const classroom: LearningClassroom = {
            id: classroomDocSnap.id,
            name: classroomData?.name || 'Untitled Classroom',
            academicYear: classroomData?.academicYear,
            year: classroomData?.year,
            semester: classroomData?.semester,
            branch: classroomData?.branch,
            class: classroomData?.class,
            division: classroomData?.division,
            batch: classroomData?.batch,
            description: classroomData?.description,
            creatorId: classroomData?.creatorId,
            teacherIds: Array.isArray(classroomData?.teacherIds) ? classroomData.teacherIds : [],
            studentIds: Array.isArray(classroomData?.studentIds) ? classroomData.studentIds : [],
            memberIds: Array.isArray(classroomData?.memberIds) ? classroomData.memberIds : [],
            joinCode: classroomData?.joinCode, // Include joinCode (might be visible to teachers in settings)
            commentsEnabled: classroomData?.commentsEnabled ?? true,
            createdAt: timestampToISO(classroomData?.createdAt),
            updatedAt: timestampToISO(classroomData?.updatedAt),
            coverImageURL: classroomData?.coverImageURL,
        } as LearningClassroom;


        // 4. Fetch Student Profiles for Members
        // Only fetch profiles if there are student members
        let studentProfiles: UserProfile[] = [];
        const studentIds = classroom.studentIds; // Get the list of student UIDs

        if (studentIds.length > 0) {
             console.log(`Fetching ${studentIds.length} student profiles for classroom ${classroomId}...`);
             try {
                 // Fetch multiple documents using 'where(admin.firestore.FieldPath.documentId(), 'in', studentIds)'
                 // Note: 'in' query has a limit of 10, so if you expect more students, you need to batch this.
                 // For simplicity, let's assume <= 100 students for now (Firebase limit is 10, Admin SDK might have higher/no limit depending on method?)
                 // Let's use `getAll` which can fetch up to 10 documents by ID
                 // For more than 10, you'd need to chunk studentIds into groups of 10 and call getAll multiple times.
                 // Let's implement chunking for robustness.
                 const chunkSize = 10; // Firebase limit for 'in'/'getAll' is 10
                 const studentProfileRefs = studentIds.map(id => firestore.collection('userProfiles').doc(id));
                 let fetchedProfiles: FirebaseAdminFirestore.DocumentSnapshot<FirebaseAdminFirestore.DocumentData>[] = [];

                 // Chunk array and fetch
                 for (let i = 0; i < studentProfileRefs.length; i += chunkSize) {
                      const chunk = studentProfileRefs.slice(i, i + chunkSize);
                      const chunkSnaps = await firestore.getAll(...chunk);
                      fetchedProfiles = fetchedProfiles.concat(chunkSnaps);
                 }


                 studentProfiles = fetchedProfiles
                     .filter(docSnap => docSnap.exists) // Only include profiles that exist
                     .map(docSnap => {
                         const data = docSnap.data();
                         // Map the profile data to UserProfile type
                         return {
                             uid: docSnap.id, // Document ID is the UID
                             role: data?.role, // Include role if available
                             displayName: data?.displayName,
                             photoURL: data?.photoURL,
                             // Include other relevant student profile fields here
                             branch: data?.branch,
                             year: data?.year,
                             // ... add more fields as needed by the UI
                         } as UserProfile;
                     });
                 console.log(`Fetched ${studentProfiles.length} existing student profiles.`);

             } catch (profileError) {
                 console.error(`Error fetching student profiles for classroom ${classroomId}:`, profileError);
                 // Log the error but don't necessarily fail the entire request.
                 // Return an empty studentProfiles array instead.
                 studentProfiles = [];
             }
        }


        console.log(`Successfully fetched classroom ${classroomId} and student profiles.`);

        // 5. Return Response
        // Return both the classroom data AND the fetched student profiles
        return NextResponse.json({ classroom: classroom, studentProfiles: studentProfiles }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching single classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        // Provide a generic error message to the client
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// PATCH /api/learning-classrooms/{classroomId}
// DELETE /api/learning-classrooms/{classroomId}
// (Keep the existing PATCH and DELETE handlers as they were)
// ... copy the existing PATCH and DELETE code here ...
// (The code for PATCH and DELETE from the previous step should be included below the GET handler)
export async function PATCH(request: Request, { params }: { params: { classroomId: string } }) { /* ... existing PATCH code ... */
     const { classroomId } = params;
     console.log(`PATCH /api/learning-classrooms/${classroomId}`);
     // ... rest of your PATCH code ...
      if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for PATCH single classroom:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); } catch (error) { console.error('Error verifying ID token for PATCH:', error); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid;
        console.log(`Authenticated user ${userId} attempting to update classroom ${classroomId}`);

        // Note: Teacher membership check is handled by Security Rules

        const updates = await request.json();
        const now = Timestamp.now();
        const updateData: { [key: string]: any } = { updatedAt: now };

        // Allowed mutable fields for classroom (must match Security Rules)
        const allowedMutableFields = ['name', 'academicYear', 'year', 'semester', 'branch', 'class', 'division', 'batch', 'description', 'commentsEnabled', 'coverImageURL'];

        let hasValidUpdate = false;
        for (const field in updates) {
            if (allowedMutableFields.includes(field)) {
                 updateData[field] = updates[field];
                 hasValidUpdate = true;
                 // Optional: Add basic type/size validation here for added safety
            } else {
                 console.warn(`PATCH classroom: Ignoring potentially disallowed field '${field}'. Security Rules will ultimately enforce.`);
            }
        }

        // Ensure there's something valid to update
        if (!hasValidUpdate) {
             console.warn("PATCH classroom: No valid mutable fields provided for update.");
            return NextResponse.json({ message: 'Bad Request: No valid fields provided for update.' }, { status: 400 });
        }

        if (!firestore) {
             console.error("Firestore not initialized for PATCH single classroom:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        const classroomDocRef = firestore.collection('learningClassrooms').doc(classroomId);
        await classroomDocRef.update(updateData);

        console.log(`✅ Classroom ${classroomId} updated successfully.`);
        return NextResponse.json({ message: 'Classroom updated successfully' }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error updating classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { classroomId: string } }) { /* ... existing DELETE code ... */
     const { classroomId } = params;
     console.log(`DELETE /api/learning-classrooms/${classroomId}`);
     // ... rest of your DELETE code ...
     if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for DELETE single classroom:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        let decodedToken;
        try { decodedToken = await adminAuth.verifyIdToken(idToken); } catch (error) { console.error('Error verifying ID token for DELETE:', error); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid;
        console.log(`Authenticated user ${userId} attempting to delete classroom ${classroomId}`);

        // Note: Teacher membership check is handled by Security Rules

        if (!firestore) {
             console.error("Firestore not initialized for DELETE single classroom:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        const classroomDocRef = firestore.collection('learningClassrooms').doc(classroomId);
        await classroomDocRef.delete();

        console.log(`✅ Classroom ${classroomId} deleted successfully.`);
        return NextResponse.json({ message: 'Classroom deleted successfully' }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error deleting classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}