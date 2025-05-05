// app/api/learning-classrooms/join/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin'; // Ensure initError is exported
import { Timestamp } from 'firebase-admin/firestore';
import admin from 'firebase-admin'; // Import admin specifically for FieldValue

// POST /api/learning-classrooms/join
// Allows authenticated users to join a classroom using a join code.
export async function POST(request: Request) {
    console.log("POST /api/learning-classrooms/join");

    // Check if Firebase Admin SDK initialized successfully
    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST /join:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - ONLY logged-in users can join)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];

        if (!idToken) {
             console.warn("POST /api/learning-classrooms/join: No token provided.");
            return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token for POST /join:', error);
            return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        console.log(`Authenticated user ${userId} is attempting to join a classroom.`);

        // 2. Validate Request Body
        const data = await request.json();
        const joinCode = data.joinCode;

        if (!joinCode || typeof joinCode !== 'string' || joinCode.trim().length !== 7) { // Assuming 7-char codes
             console.warn("Bad Request: Invalid or missing joinCode format.");
            return NextResponse.json({ message: 'Bad Request: Valid 7-character join code is required.' }, { status: 400 });
        }
        const trimmedJoinCode = joinCode.trim().toUpperCase(); // Match case used in creation


        // 3. Find Classroom by Join Code
        console.log(`Attempting to find classroom with join code: ${trimmedJoinCode}`);
        const classroomsRef = firestore.collection('learningClassrooms');
        // Query for a classroom where the joinCode matches
        const classroomSnapshot = await classroomsRef.where('joinCode', '==', trimmedJoinCode).limit(1).get();

        if (classroomSnapshot.empty) {
             console.warn(`No classroom found with join code: ${trimmedJoinCode}`);
             // Return a generic "Invalid code" message for security
            return NextResponse.json({ message: 'Invalid join code.' }, { status: 404 }); // 404 Not Found is appropriate
        }

        const classroomDoc = classroomSnapshot.docs[0];
        const classroomData = classroomDoc.data();
        const classroomId = classroomDoc.id;
        console.log(`Found classroom ID ${classroomId} with matching join code.`);

        // 4. Check if User is Already a Member
         // Ensure memberIds is an array before checking
        const memberIds = Array.isArray(classroomData.memberIds) ? classroomData.memberIds : [];
        if (memberIds.includes(userId)) {
             console.warn(`User ${userId} is already a member of classroom ${classroomId}.`);
            return NextResponse.json({ message: 'You are already a member of this classroom.' }, { status: 409 }); // 409 Conflict
        }

        // Optional: Add checks here if the classroom is full, closed, or has other restrictions
        // e.g., check classroomData.status or member count limits.

        // 5. Add User to Classroom Members (using Admin SDK)
        console.log(`Adding user ${userId} to classroom ${classroomId}...`);
        const classroomRef = classroomsRef.doc(classroomId);

        // Use arrayUnion to atomically add the user ID to the arrays without overwriting existing members
        await classroomRef.update({
            studentIds: admin.firestore.FieldValue.arrayUnion(userId), // Add to studentIds array
            memberIds: admin.firestore.FieldValue.arrayUnion(userId),   // Add to memberIds array
            updatedAt: Timestamp.now(), // Update timestamp
        });

        console.log(`✅ User ${userId} successfully joined classroom ${classroomId}.`);

        // 6. Return Success Response
        // Return the classroomId so the frontend can redirect
        return NextResponse.json({ message: 'Successfully joined classroom!', classroomId: classroomId }, { status: 200 }); // 200 OK

    } catch (error) {
        console.error('❌ Error joining learning classroom:', error);
        // Provide a generic error message to the client for security
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

// No GET, PATCH, DELETE needed for this specific /join endpoint