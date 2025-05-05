// app/api/learning-classrooms/[classroomId]/learning-entries/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin'; // Ensure initError is exported
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

// Helper to check if a user is a teacher member of a classroom (needed for filtering entries)
// Re-using the logic from security rules/other APIs
const isTeacherMember = async (userId: string, classroomId: string): Promise<boolean> => {
    if (!firestore) return false;
    try {
        const classroomDoc = await firestore.collection('learningClassrooms').doc(classroomId).get();
        // Check if doc exists, data is map, has teacherIds field, is array, and contains userId
        return classroomDoc.exists
               && classroomDoc.data()?.isMap() === true // Use isMap() check
               && 'teacherIds' in (classroomDoc.data() as any)
               && Array.isArray((classroomDoc.data() as any).teacherIds)
               && (classroomDoc.data() as any).teacherIds.includes(userId);
    } catch (error) {
        console.error(`Error checking teacher membership for user ${userId} in classroom ${classroomId}:`, error);
        return false;
    }
};


// GET /api/learning-classrooms/{classroomId}/learning-entries
// Fetches learning entries for a specific classroom.
// Teachers can filter by studentId query param. Students see only their own.
export async function GET(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/learning-entries`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET learning-entries:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required for reading this subcollection via rules)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("GET learning-entries: No token provided (unauthenticated).");
             // Security rules will prevent unauthenticated reads, but returning 401 explicitly is clearer.
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let userId = null;
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            console.log(`Authenticated user ${userId} fetching learning entries for ${classroomId}`);
        } catch (error) {
            console.warn('Invalid ID token for GET learning-entries:', (error as Error).message);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

         if (!firestore) {
             console.error("Firestore not initialized for GET learning-entries:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Determine Query Logic based on User Role and Query Params
        const { searchParams } = new URL(request.url);
        const requestedStudentId = searchParams.get('studentId'); // Teacher might request entries for a specific student

        let entriesQuery: FirebaseAdminFirestore.Query<FirebaseAdminFirestore.DocumentData>;

        // Check if the requesting user is a teacher in this classroom
        const userIsTeacher = await isTeacherMember(userId, classroomId);

        if (userIsTeacher && requestedStudentId) {
            // If teacher requests entries for a specific student
            console.log(`Teacher ${userId} requesting entries for student ${requestedStudentId} in classroom ${classroomId}`);
             // Add check to ensure requestedStudentId is valid (e.g., exists in studentIds array of classroom?) - optional
            entriesQuery = firestore.collection('learningClassrooms').doc(classroomId)
                                     .collection('learningEntries')
                                     .where('studentId', '==', requestedStudentId) // Filter by the requested student ID
                                     .orderBy('entryDate', 'desc'); // Order by the entry date
        } else if (userIsTeacher) {
             // If teacher requests all entries (no studentId param) - This case might not be used by UI,
             // but rule allows teachers to read all entries.
             // You might want to disallow this or paginate/limit heavily.
             // For now, let's return an empty list or specific student's if no ID.
             // The UI is designed to list students for teachers, and then entries per student.
             // So, if a teacher fetches *without* studentId, return an empty list or redirect logic on frontend.
             // Or, maybe fetch entries for the FIRST student in the class for a default view?
             // Let's align with UI intent: Teacher sees list of students, then clicks student to see entries.
             // So, this endpoint *requires* a studentId param for teachers.
             console.warn(`Teacher ${userId} attempted to fetch all entries for classroom ${classroomId} without studentId param.`);
             // Or you could query all entries, but that might be too much data
             // entriesQuery = firestore.collection('learningClassrooms').doc(classroomId).collection('learningEntries').orderBy('entryDate', 'desc');
             return NextResponse.json({ entries: [] }, { status: 200 }); // Return empty list if teacher requests without studentId

        } else {
            // If user is NOT a teacher, they can only see their OWN entries (Security Rule enforces this)
            console.log(`Student ${userId} fetching their own entries for classroom ${classroomId}`);
            entriesQuery = firestore.collection('learningClassrooms').doc(classroomId)
                                     .collection('learningEntries')
                                     .where('studentId', '==', userId) // Filter by the authenticated user's ID
                                     .orderBy('entryDate', 'desc'); // Order by entry date
        }

        // Execute the query
        const entriesSnapshot = await entriesQuery.get();


        // 3. Process Results
        const learningEntries: StudentLearningEntry[] = entriesSnapshot.docs.map(doc => {
            const data = doc.data();
            // Convert timestamps, provide defaults for optional/array fields
            return {
                id: doc.id,
                classroomId: classroomId, // Add classroomId from path
                studentId: data.studentId,
                title: data.title || 'Untitled Entry',
                entryDate: timestampToISO(data.entryDate),
                weekNumber: data.weekNumber,
                learningType: data.learningType,
                tasksPerformed: data.tasksPerformed || '',
                planning: data.planning || '',
                nextSteps: data.nextSteps || '',
                challenges: data.challenges || '',
                learning: data.learning || '',
                durationHours: data.durationHours,
                links: Array.isArray(data.links) ? data.links : [], // Ensure array
                reportFileMetadata: data.reportFileMetadata, // Keep metadata
                presentationFileMetadata: data.presentationFileMetadata, // Keep metadata
                certificateFileMetadata: data.certificateFileMetadata, // Keep metadata
                reportFileUrl: data.reportFileUrl, // Include future URL placeholder
                presentationFileUrl: data.presentationFileUrl, // Include future URL placeholder
                certificateFileUrl: data.certificateFileUrl, // Include future URL placeholder
                customFieldsData: data.customFieldsData || {}, // Ensure object/map
                isSubmitted: data.isSubmitted ?? false, // Default false
                submissionDate: timestampToISO(data.submissionDate),
                createdAt: timestampToISO(data.createdAt),
                updatedAt: timestampToISO(data.updatedAt),
            } as StudentLearningEntry;
        });

        console.log(`Found ${learningEntries.length} learning entries for the query.`);

        // 4. Return Response
        return NextResponse.json({ entries: learningEntries }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching learning entries for classroom ${classroomId}:`, error);
        // Provide a generic error message to the client
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// POST /api/learning-classrooms/{classroomId}/learning-entries
// Creates a new learning entry for the authenticated student.
export async function POST(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`POST /api/learning-classrooms/${classroomId}/learning-entries`);

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST learning-entries:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce student + self-creation)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("POST learning-entries: No token provided.");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for POST learning-entries:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        // Get user name/photo for potential storage in the entry or for client-side display (less common for entries)
        // const userName = decodedToken.name || 'Anonymous';
        // const userPhotoURL = decodedToken.picture || null;

        console.log(`Authenticated user ${userId} is attempting to create a learning entry for ${classroomId}.`);

        // NOTE: Security rules already enforce that:
        // 1. The user is authenticated.
        // 2. The user is a student member of the classroom.
        // 3. The 'studentId' field in the submitted data matches the authenticated user's UID.
        // 4. Required fields like title, entryDate, learningType, task/planning/etc are present and valid.

        // 2. Validate Request Body
        const data = await request.json();

        // Basic required field validation (more extensive validation is in Security Rules)
        const { title, entryDate, learningType, tasksPerformed, planning, nextSteps, challenges, learning } = data;

        if (!title || !entryDate || !learningType || !tasksPerformed || !planning || !nextSteps || !challenges || !learning) {
             console.warn("Bad Request: Missing required entry fields.");
            return NextResponse.json({ message: 'Bad Request: Missing required fields (title, date, type, tasks, planning, next steps, challenges, learning).' }, { status: 400 });
        }
        // Validate entryDate format (should be ISO string from frontend)
        const parsedEntryDate = new Date(entryDate);
        if (isNaN(parsedEntryDate.getTime())) {
             console.warn("Bad Request: Invalid entryDate format.");
            return NextResponse.json({ message: 'Bad Request: Invalid entry date format.' }, { status: 400 });
        }
        // Validate learningType
        const validLearningTypes = ['PBL', 'SBL', 'TBL'];
        if (!validLearningTypes.includes(learningType)) {
             console.warn("Bad Request: Invalid learningType.");
            return NextResponse.json({ message: 'Bad Request: Invalid learning type.' }, { status: 400 });
        }

        // Handle optional fields and nested data (like customFieldsData, file metadata)
        const weekNumber = data.weekNumber; // Optional
        const durationHours = data.durationHours; // Optional
        const links = Array.isArray(data.links) ? data.links : []; // Optional array, ensure array
        const customFieldsData = data.customFieldsData || {}; // Optional map, ensure object
        const isSubmitted = data.isSubmitted ?? false; // Optional boolean, default false
        const submissionDate = data.submissionDate ? new Date(data.submissionDate) : null; // Optional date

        // Handle Temporary File Metadata (passed from frontend when files were "attached")
        // We are NOT processing actual file uploads here.
        // The frontend sends metadata for temporary files, and we store that metadata.
        const reportFileMetadata = data.reportFileMetadata || undefined;
        const presentationFileMetadata = data.presentationFileMetadata || undefined;
        const certificateFileMetadata = data.certificateFileMetadata || undefined;

        // Basic validation on metadata structure if present
        if (reportFileMetadata && (!reportFileMetadata.filename || !reportFileMetadata.size || !reportFileMetadata.fileType)) {
             console.warn("Bad Request: Invalid reportFileMetadata structure.");
             return NextResponse.json({ message: 'Bad Request: Invalid report file metadata structure.' }, { status: 400 });
        }
        // Add similar checks for other metadata fields...

        // 3. Prepare Learning Entry Document
        const now = Timestamp.now(); // Get server timestamp for creation/update
        const newEntryData: Omit<StudentLearningEntry, 'id' | 'createdAt'> = {
            classroomId: classroomId, // Ensure classroomId is included
            studentId: userId, // Ensure studentId is the authenticated user's ID
            title: title.trim(),
            entryDate: Timestamp.fromDate(parsedEntryDate), // Convert Date object to Firestore Timestamp
            weekNumber: typeof weekNumber === 'number' ? weekNumber : undefined, // Store if valid number
            learningType: learningType,
            tasksPerformed: tasksPerformed.trim(),
            planning: planning.trim(),
            nextSteps: nextSteps.trim(),
            challenges: challenges.trim(),
            learning: learning.trim(),
            durationHours: typeof durationHours === 'number' ? durationHours : undefined, // Store if valid number
            links: links, // Store links array
            customFieldsData: customFieldsData, // Store custom fields map

            // Store temporary file metadata received from the frontend
            reportFileMetadata: reportFileMetadata,
            presentationFileMetadata: presentationFileMetadata,
            certificateFileMetadata: certificateFileMetadata,

            // Initialize actual file URLs as null - these will be updated later upon *actual* file upload
            reportFileUrl: null,
            presentationFileUrl: null,
            certificateFileUrl: null,

            isSubmitted: isSubmitted, // Store submission status
            submissionDate: isSubmitted && submissionDate ? Timestamp.fromDate(submissionDate) : null, // Store submission date if submitted

            // createdAt will be set by Firestore .add() with server timestamp
            updatedAt: now, // Use server timestamp for updatedAt
        };

        // 4. Save Document to Firestore Subcollection
         if (!firestore) {
             console.error("Firestore not initialized for POST learning-entries:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Saving new learning entry for classroom ${classroomId} by student ${userId}...`);

        // Add the document to the learningEntries subcollection
        const docRef = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('learningEntries')
                                                    .add({
                                                        ...newEntryData,
                                                        createdAt: now, // Explicitly set createdAt server timestamp
                                                    });

        console.log(`✅ Learning entry created successfully with ID: ${docRef.id} for student ${userId} in classroom ${classroomId}.`);

        // 5. Return Success Response
        // Return the new entry ID
        return NextResponse.json({ message: 'Learning entry created successfully', entryId: docRef.id }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error(`❌ Error creating learning entry for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        // Provide a generic error message to the client
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// Placeholder PATCH and DELETE handlers for /learning-entries/{entryId} will be in a separate file
// This file only handles the collection endpoints (/learning-entries)