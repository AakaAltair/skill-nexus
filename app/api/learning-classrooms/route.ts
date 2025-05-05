// app/api/learning-classrooms/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin'; // Ensure initError is exported
import { LearningClassroom, UserProfile } from '@/lib/types/learning'; // Import necessary types
import { Timestamp } from 'firebase-admin/firestore';
import admin from 'firebase-admin'; // Import admin for FieldValue (used in /join, but import here is fine)
import crypto from 'crypto'; // Node.js built-in module for generating secure join code

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// Helper to check if a user is a teacher member of a classroom (Needed for other APIs, kept here)
// Note: This helper might be better placed in a shared server-side utility file if used by many APIs
const isTeacherMember = async (userId: string, classroomId: string): Promise<boolean> => {
    if (!firestore) {
         console.error("Firestore not initialized in isTeacherMember helper.");
         return false;
    }
    try {
        const classroomDoc = await firestore.collection('learningClassrooms').doc(classroomId).get();
        // Use robust checks for existence and type before accessing properties
        const data = classroomDoc.data();
        return classroomDoc.exists
               && data !== undefined // Check data is not undefined
               && data?.isMap?.() === true // Check data is a map (method check)
               && 'teacherIds' in data // Check field exists
               && Array.isArray(data.teacherIds) // Check field is array
               && data.teacherIds.includes(userId); // Check for containment
    } catch (error) {
        console.error(`Error checking teacher membership for user ${userId} in classroom ${classroomId}:`, error);
        return false; // Assume not authorized if error occurs
    }
};


// Helper to generate a unique join code
// Loop until a unique code is generated (simple approach, better for low collision risk)
const generateUniqueJoinCode = async (length = 7): Promise<string> => {
     if (!firestore) {
         console.error("Firestore not initialized, cannot generate unique join code.");
         throw new Error("Server configuration error: Firestore not initialized.");
     }
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const classroomsRef = firestore.collection('learningClassrooms');

    // Declare the variable 'code' here
    let code = '';

    let isCodeUnique = false;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loops

    while (!isCodeUnique && attempts < maxAttempts) {
         attempts++;
         code = ''; // Reset code for each attempt

         // Calculate byte length and generate random bytes
         const byteLength = Math.ceil(length * (Math.log2(charset.length) / 8));
         const randomBytes = crypto.randomBytes(byteLength);

         // Build the code from random bytes
         for (let i = 0; i < length; i++) {
             // Ensure index is within the bounds of randomBytes array
             const byte = randomBytes[i % randomBytes.length];
             const randomIndex = byte % charset.length;
             code += charset[randomIndex];
         }

         // Check if code exists in Firestore
         const existingClassroomSnapshot = await classroomsRef.where('joinCode', '==', code).limit(1).get();
         isCodeUnique = existingClassroomSnapshot.empty; // Code is unique if no documents found

         if (!isCodeUnique) {
             console.warn(`Generated join code ${code} already exists (attempt ${attempts}), regenerating.`);
         }
    }

    if (!isCodeUnique) {
         // If max attempts reached without generating unique code
         console.error(`Failed to generate a unique join code after ${maxAttempts} attempts.`);
         throw new Error("Failed to generate a unique join code. Please try again."); // Throw a more user-friendly error
    }

    console.log(`Unique join code generated: ${code}`);
    return code; // Return the unique code
};


// GET /api/learning-classrooms
// Fetches classrooms the authenticated user is a member of.
// Security rules enforce reading only documents where user is a member.
export async function GET(request: Request) {
    try {
        // Check if Firebase Admin SDK initialized successfully
         if (adminAuth === null || firestore === null || initError !== null) {
             console.error("Firebase Admin SDK not initialized for GET /learning-classrooms:", initError);
            return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
        }

        // 1. Authenticate User (Required for fetching member-specific list)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        let userId = null;
        if (!idToken) {
             // If no token, user is not authenticated. Cannot fetch member-specific list.
             console.log("GET /api/learning-classrooms: No token provided (unauthenticated).");
             // Returning empty list is consistent with security rules requiring membership for read.
             return NextResponse.json({ classrooms: [] }, { status: 200 }); // Return empty list for unauthenticated users
        }

        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            userId = decodedToken.uid;
            console.log(`Authenticated user ${userId} for GET /api/learning-classrooms`);
        } catch (error) {
            // Invalid token - treat as unauthenticated for this request
            console.warn('Invalid ID token for GET /api/learning-classrooms:', (error as Error).message);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); // Return Unauthorized for invalid token
        }

         if (!firestore) {
             console.error("Firestore not initialized for GET /learning-classrooms:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }


        // 2. Query Firestore
        // Fetch classrooms where the user's UID is in the memberIds array
        // This query is allowed by security rules if request.auth.uid is used.
        const classroomsSnapshot = await firestore.collection('learningClassrooms')
                                                .where('memberIds', 'array-contains', userId)
                                                .orderBy('academicYear', 'desc') // Example sorting
                                                .orderBy('createdAt', 'asc') // Example secondary sort
                                                .get();

        // 3. Process Results
        const classrooms: LearningClassroom[] = classroomsSnapshot.docs.map(doc => {
            const data = doc.data();
            // Convert timestamps before sending, provide defaults for arrays
            return {
                id: doc.id,
                name: data.name,
                academicYear: data.academicYear,
                year: data.year,
                semester: data.semester,
                branch: data.branch,
                class: data.class ?? null, // Use null for optional fields
                division: data.division ?? null, // Use null for optional fields
                batch: data.batch ?? null, // Use null for optional fields
                description: data.description ?? null, // Use null for optional fields
                teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds : [], // Ensure array
                studentIds: Array.isArray(data.studentIds) ? data.studentIds : [], // Ensure array
                memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],   // Ensure array
                joinCode: data.joinCode,
                commentsEnabled: data.commentsEnabled ?? true, // Default to true
                createdAt: timestampToISO(data.createdAt),
                updatedAt: timestampToISO(data.updatedAt),
                coverImageURL: data.coverImageURL ?? null, // Use null for optional fields
                creatorId: data.creatorId // Include creatorId in the response
            } as LearningClassroom;
        });

        console.log(`Successfully fetched ${classrooms.length} learning classrooms for user ${userId}.`);

        // 4. Return Response
        return NextResponse.json({ classrooms }, { status: 200 });

    } catch (error) {
        console.error('❌ Error fetching learning classrooms:', error);
        // Provide a generic error message to the client for security
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// POST /api/learning-classrooms
// Allows ANY authenticated user to create a new learning classroom.
// Security rules enforce authentication and validation of the data structure.
export async function POST(request: Request) {
    console.log("POST /api/learning-classrooms");
    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST /learning-classrooms:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - ANY logged-in user can create)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("POST /api/learning-classrooms: No token provided (unauthenticated).");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for POST /learning-classrooms:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        // const userName = decodedToken.name || 'Anonymous'; // Optional: fetch display name from profile later if needed

        console.log(`Authenticated user ${userId} is attempting to create a classroom.`);

        // NOTE: Teacher role check is removed here, as any authenticated user can create.
        // Permissions for managing the classroom content are handled by Security Rules
        // based on the 'teacherIds' array, which initially contains the creator.

        // 2. Validate Request Body
        const data = await request.json();

        // Define required fields for classroom creation
        const requiredFields = ['name', 'academicYear', 'year', 'semester', 'branch', 'learningType'];
        const missingFields = requiredFields.filter(field => {
             const value = data[field];
            // Check if the field is missing or is an empty string after trimming
            return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);
        });

        if (missingFields.length > 0) {
             console.warn("Missing or invalid required fields for classroom creation:", missingFields);
            return NextResponse.json({ message: `Bad Request: Missing or invalid required fields: ${missingFields.join(', ')}` }, { status: 400 });
        }

         // Basic data validation (can be expanded)
         // The frontend handles sending the custom string in learningType if 'Custom' was selected.
         if (typeof data.learningType !== 'string' || data.learningType.trim().length === 0) {
             return NextResponse.json({ message: 'Validation Error: Invalid learningType.' }, { status: 400 });
         }

        if (typeof data.commentsEnabled !== 'boolean' && data.commentsEnabled !== undefined) {
             return NextResponse.json({ message: 'Validation Error: Invalid type for commentsEnabled.' }, { status: 400 });
        }


        // 3. Generate Unique Join Code
        // This uses the async helper to ensure uniqueness
        const joinCode = await generateUniqueJoinCode();


        // 4. Prepare Classroom Document
        const now = Timestamp.now(); // Get server timestamp once
        const newClassroomData: Omit<LearningClassroom, 'id' | 'createdAt'> = {
            name: data.name.trim(),
            academicYear: data.academicYear.trim(),
            year: data.year.trim(), // Include year
            semester: data.semester.trim(), // Include semester
            branch: data.branch.trim(), // Include branch
            batch: data.batch?.trim() || null, // --- FIX: Use null instead of undefined ---
            learningType: data.learningType.trim(), // Store the determined learning type
            // class: data.class?.trim() || undefined, // Removed for simplicity in frontend
            // division: data.division?.trim() || undefined, // Removed for simplicity in frontend
            description: data.description?.trim() || null, // --- FIX: Use null instead of undefined ---
            creatorId: userId, // Store the creator's UID
            teacherIds: [userId], // Creator is the first teacher
            studentIds: [], // Initially empty
            memberIds: [userId], // Creator is the first member (teacher)
            joinCode: joinCode,
            commentsEnabled: data.commentsEnabled ?? true, // Default true if not provided
            updatedAt: now, // Use server timestamp for updatedAt
            coverImageURL: data.coverImageURL?.trim() || null, // --- FIX: Use null instead of undefined ---
        };

        // 5. Save Document to Firestore
         if (!firestore) {
             console.error("Firestore not initialized for POST /learning-classrooms:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Saving new classroom document...`, newClassroomData);

        // Add the document to the learningClassrooms collection.
        // Firestore will automatically add createdAt if it's not present, but we set it explicitly.
        const docRef = await firestore.collection('learningClassrooms').add({
            ...newClassroomData,
            createdAt: now, // Explicitly set createdAt server timestamp
        });

        console.log(`✅ Classroom created successfully with ID: ${docRef.id} and Join Code: ${joinCode}.`);

        // 6. Return Success Response
        // Include the generated joinCode in the response so the frontend can display it
        return NextResponse.json({ message: 'Learning page created successfully', classroomId: docRef.id, joinCode: joinCode }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error('❌ Error creating learning classroom:', error);
        // Provide a generic error message to the client for security, but log details on the server
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// No PATCH or DELETE handlers needed for the collection endpoint (/api/learning-classrooms)