// app/api/learning-classrooms/[classroomId]/custom-fields/route.ts

import { NextResponse } from 'next/server';
import { firestore, adminAuth, initError } from '@/lib/firebaseAdmin';
import { CustomLearningField } from '@/lib/types/learning'; // Import type
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (timestamp?: any): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    if (typeof timestamp === 'string') return timestamp;
    return undefined;
};

// GET /api/learning-classrooms/{classroomId}/custom-fields
// Fetches custom learning fields for a specific classroom.
export async function GET(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/custom-fields`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET custom-fields:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required for reading this subcollection via rules)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("GET custom-fields: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for GET custom-fields:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        // User is authenticated. Security rules will ensure they are a member of the classroom.

         if (!firestore) {
             console.error("Firestore not initialized for GET custom-fields:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Query Firestore Subcollection
        // Security rules will enforce that the user is a member of the parent classroom.
        const customFieldsSnapshot = await firestore.collection('learningClassrooms').doc(classroomId)
                                                      .collection('customLearningFields')
                                                      .orderBy('order', 'asc') // Order by display order
                                                      .orderBy('createdAt', 'asc') // Secondary sort
                                                      .get();

        // 3. Process Results
        const customFields: CustomLearningField[] = customFieldsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                classroomId: classroomId, // Add classroomId
                fieldName: data.fieldName || '',
                fieldType: data.fieldType || 'text', // Default to text
                isRequired: data.isRequired ?? false, // Default to false
                order: data.order ?? 0, // Default to 0
                options: Array.isArray(data.options) ? data.options : [], // Ensure array for select options
                createdAt: timestampToISO(data.createdAt),
                updatedAt: timestampToISO(data.updatedAt),
            } as CustomLearningField;
        });

        console.log(`Found ${customFields.length} custom fields for classroom ${classroomId}.`);

        // 4. Return Response
        return NextResponse.json({ customFields }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching custom fields for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// POST /api/learning-classrooms/{classroomId}/custom-fields
// Creates a new custom learning field (Teacher only via Security Rules).
export async function POST(request: Request, { params }: { params: { classroomId: string } }) {
    const { classroomId } = params;
    console.log(`POST /api/learning-classrooms/${classroomId}/custom-fields`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for POST custom-fields:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher role)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("POST custom-fields: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for POST custom-fields:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid; // Get user ID, but security rules do the teacher check

        // 2. Validate Request Body
        const data = await request.json();
        const { fieldName, fieldType, isRequired, order, options } = data;

        // Basic validation (more extensive validation is in Security Rules)
        const validFieldTypes = ['text', 'textarea', 'number', 'date', 'url', 'file', 'checkbox', 'select'];
        if (typeof fieldName !== 'string' || fieldName.trim().length === 0) { return NextResponse.json({ message: 'Bad Request: fieldName is required.' }, { status: 400 }); }
        if (typeof fieldType !== 'string' || !validFieldTypes.includes(fieldType)) { return NextResponse.json({ message: `Bad Request: Invalid fieldType. Must be one of ${validFieldTypes.join(', ')}.` }, { status: 400 }); }
        if (typeof isRequired !== 'boolean' && isRequired !== undefined) { return NextResponse.json({ message: 'Bad Request: isRequired must be boolean.' }, { status: 400 }); }
        if (typeof order !== 'number' && order !== undefined) { return NextResponse.json({ message: 'Bad Request: order must be a number.' }, { status: 400 }); }
        // Check options validity if fieldType is 'select'
        if (fieldType === 'select' && (!Array.isArray(options) || options.some(opt => typeof opt !== 'string' || opt.trim().length === 0))) {
             return NextResponse.json({ message: 'Bad Request: options must be a non-empty array of strings for type "select".' }, { status: 400 });
        } else if (fieldType !== 'select' && options !== undefined && options !== null) {
             console.warn(`POST custom-fields: Ignoring 'options' for non-select fieldType '${fieldType}'.`);
             // Remove options if not applicable
             delete data.options;
        }


        // 3. Prepare Document Data
        const now = Timestamp.now();
        const newFieldData = {
            classroomId: classroomId, // Ensure classroomId is included
            fieldName: fieldName.trim(),
            fieldType: fieldType,
            isRequired: isRequired ?? false,
            order: order ?? 0,
            options: fieldType === 'select' ? (Array.isArray(options) ? options.map((opt: string) => opt.trim()) : []) : undefined, // Only save options for select type
            createdAt: now,
            updatedAt: now,
        };

        // 4. Save Document to Firestore Subcollection
         if (!firestore) {
             console.error("Firestore not initialized for POST custom-fields:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Saving new custom field for classroom ${classroomId}...`, newFieldData);

        const docRef = await firestore.collection('learningClassrooms').doc(classroomId)
                                                    .collection('customLearningFields')
                                                    .add(newFieldData);

        console.log(`✅ Custom field created successfully with ID: ${docRef.id} in classroom ${classroomId}.`);

        // 5. Return Success Response
        return NextResponse.json({ message: 'Custom field created successfully', fieldId: docRef.id }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error(`❌ Error creating custom field for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}

