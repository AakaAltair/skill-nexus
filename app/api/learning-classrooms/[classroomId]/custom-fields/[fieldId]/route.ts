// app/api/learning-classrooms/[classroomId]/custom-fields/[fieldId]/route.ts

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

// GET /api/learning-classrooms/{classroomId}/custom-fields/{fieldId}
// Fetches a single custom learning field (Teacher only via Security Rules).
export async function GET(request: Request, { params }: { params: { classroomId: string, fieldId: string } }) {
    const { classroomId, fieldId } = params;
    console.log(`GET /api/learning-classrooms/${classroomId}/custom-fields/${fieldId}`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for GET single custom-field:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce membership)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("GET single custom-field: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for GET single custom-field:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        // User is authenticated. Security rules will ensure they are a member of the classroom.

         if (!firestore) {
             console.error("Firestore not initialized for GET single custom-field:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        // 2. Fetch the single document
        const fieldDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('customLearningFields').doc(fieldId);
        const fieldDocSnap = await fieldDocRef.get();

        if (!fieldDocSnap.exists) {
             console.warn(`Custom field ${fieldId} not found in classroom ${classroomId}.`);
            return NextResponse.json({ message: 'Custom field not found.' }, { status: 404 });
        }

        const data = fieldDocSnap.data();

        // 3. Process Result
        const customField: CustomLearningField = {
            id: fieldDocSnap.id,
            classroomId: classroomId,
            fieldName: data?.fieldName || '',
            fieldType: data?.fieldType || 'text',
            isRequired: data?.isRequired ?? false,
            order: data?.order ?? 0,
            options: Array.isArray(data?.options) ? data.options : [],
            createdAt: timestampToISO(data?.createdAt),
            updatedAt: timestampToISO(data?.updatedAt),
        } as CustomLearningField;

        console.log(`Successfully fetched custom field ${fieldId}.`);

        // 4. Return Response
        return NextResponse.json({ customField }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error fetching custom field ${fieldId} for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// PATCH /api/learning-classrooms/{classroomId}/custom-fields/{fieldId}
// Updates a single custom learning field (Teacher only via Security Rules).
export async function PATCH(request: Request, { params }: { params: { classroomId: string, fieldId: string } }) {
    const { classroomId, fieldId } = params;
    console.log(`PATCH /api/learning-classrooms/${classroomId}/custom-fields/${fieldId}`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for PATCH custom-field:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher role)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("PATCH custom-field: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for PATCH custom-field:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid; // Get user ID, security rules do the teacher check


        // 2. Validate Request Body
        const updates = await request.json();

        // Basic validation on fields allowed by Security Rules (fieldName, fieldType, isRequired, order, options, updatedAt)
        // More extensive validation is in Security Rules.
        const allowedMutableFields = ['fieldName', 'fieldType', 'isRequired', 'order', 'options'];
        const updateData: { [key: string]: any } = {};
        let hasValidUpdate = false;

        const validFieldTypes = ['text', 'textarea', 'number', 'date', 'url', 'file', 'checkbox', 'select'];

        for (const field in updates) {
             if (allowedMutableFields.includes(field)) {
                 // Add specific type validation for fields being updated
                 if (field === 'fieldName' && typeof updates[field] !== 'string') continue;
                 if (field === 'fieldType' && (typeof updates[field] !== 'string' || !validFieldTypes.includes(updates[field]))) continue;
                 if (field === 'isRequired' && typeof updates[field] !== 'boolean') continue;
                 if (field === 'order' && typeof updates[field] !== 'number') continue;
                 if (field === 'options') {
                     // If updating options, ensure fieldType is select and options is valid array of strings
                     const currentFieldDoc = await firestore.collection('learningClassrooms').doc(classroomId).collection('customLearningFields').doc(fieldId).get();
                     if (!currentFieldDoc.exists || currentFieldDoc.data()?.fieldType !== 'select' || !Array.isArray(updates[field]) || updates[field].some((opt: any) => typeof opt !== 'string' || opt.trim().length === 0)) {
                          console.warn(`PATCH custom-field: Invalid options format or not a select type field.`);
                          continue; // Skip invalid options update
                     }
                      updateData[field] = updates[field].map((opt: string) => opt.trim()); // Trim options
                 } else if (field === 'fieldType' && updates[field] !== 'select') {
                      // If changing fieldType away from select, ensure options are removed/set to null
                      // Note: Security rules might handle this implicitly with keys().hasOnly()
                      // It might be safer to explicitly set options: null here if fieldType is changed away from 'select'.
                      // updateData['options'] = null; // Or undefined
                      updateData[field] = updates[field]; // Add the fieldType update
                 }
                 else {
                      // For other allowed fields, add them to updateData
                      updateData[field] = updates[field];
                 }


                // If we got here, the field is allowed and basic type check passed (except options)
                hasValidUpdate = true;
            } else {
                 console.warn(`PATCH custom-field: Ignoring potentially disallowed field '${field}'. Security Rules will ultimately enforce.`);
            }
        }

        // Add server timestamp for updatedAt
        updateData.updatedAt = Timestamp.now();

        // Ensure there's something valid to update besides updatedAt
        if (!hasValidUpdate) {
             console.warn("PATCH custom-field: No valid fields provided for update.");
            return NextResponse.json({ message: 'Bad Request: No valid fields provided for update.' }, { status: 400 });
        }

         if (!firestore) {
             console.error("Firestore not initialized for PATCH custom-field:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }

        const fieldDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('customLearningFields').doc(fieldId);
        await fieldDocRef.update(updateData);

        console.log(`✅ Custom field ${fieldId} updated successfully.`);
        return NextResponse.json({ message: 'Custom field updated successfully' }, { status: 200 });

    } catch (error) {
        console.error(`❌ Error updating custom field ${fieldId} for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}


// DELETE /api/learning-classrooms/{classroomId}/custom-fields/{fieldId}
// Deletes a single custom learning field (Teacher only via Security Rules).
export async function DELETE(request: Request, { params }: { params: { classroomId: string, fieldId: string } }) {
    const { classroomId, fieldId } = params;
    console.log(`DELETE /api/learning-classrooms/${classroomId}/custom-fields/${fieldId}`);

    if (adminAuth === null || firestore === null || initError !== null) {
         console.error("Firebase Admin SDK not initialized for DELETE custom-field:", initError);
        return NextResponse.json({ message: 'Server configuration error: Firebase Admin not initialized.' }, { status: 500 });
    }

    try {
        // 1. Authenticate User (Required - Security rules will enforce teacher role)
        const authHeader = request.headers.get('Authorization');
        const idToken = authHeader?.split('Bearer ')[1];
        if (!idToken) { console.warn("DELETE custom-field: No token provided."); return NextResponse.json({ message: 'Unauthorized: No token provided' }, { status: 401 }); }
        try { await adminAuth.verifyIdToken(idToken); }
        catch (error) { console.warn('Invalid ID token for DELETE custom-field:', (error as Error).message); return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 }); }
        const userId = decodedToken.uid; // Get user ID, security rules do the teacher check


        // 2. Delete the document
         if (!firestore) {
             console.error("Firestore not initialized for DELETE custom-field:", initError);
             return NextResponse.json({ message: 'Server configuration error: Firestore not initialized.' }, { status: 500 });
         }
        console.log(`Deleting custom field ${fieldId} from classroom ${classroomId}...`);

        const fieldDocRef = firestore.collection('learningClassrooms').doc(classroomId)
                                        .collection('customLearningFields').doc(fieldId);
        await fieldDocRef.delete();

        console.log(`✅ Custom field ${fieldId} deleted successfully.`);

        // 3. Return Success Response
        return NextResponse.json({ message: 'Custom field deleted successfully' }, { status: 200 }); // 200 OK

    } catch (error) {
        console.error(`❌ Error deleting custom field ${fieldId} for classroom ${classroomId}:`, error);
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
    }
}