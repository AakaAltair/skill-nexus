// CORRECT LOCATION: app/api/projects/[projectId]/updates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Import admin instances
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import admin types/helpers
// Import Attachment type along with ProjectUpdate
import { ProjectUpdate, Attachment } from '@/lib/types/project';

// Helper function to get Document Reference (optional but clean)
function getProjectRef(projectId: string) {
    if (!firestore) throw new Error("Firestore not initialized.");
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        throw new Error("Project ID missing or invalid for getProjectRef.");
    }
    return firestore.collection('projects').doc(projectId);
}


// --- GET Handler: Fetch Updates for a Project ---
export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const projectId = params.projectId;
    console.log(`--- GET /api/projects/${projectId}/updates ---`);
    try {
        if (!firestore) throw new Error("Firestore not initialized.");
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
            return NextResponse.json({ error: "Project ID missing or invalid" }, { status: 400 });
        }
        const projectRef = getProjectRef(projectId);
        const updatesCollectionRef = projectRef.collection('updates');
        const queryRef = updatesCollectionRef.orderBy('createdAt', 'desc').limit(50);
        const querySnapshot = await queryRef.get();

        const updates = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const updateData: Omit<ProjectUpdate, 'id'> & { id: string } = {
                id: doc.id,
                authorId: data.authorId || '',
                authorName: data.authorName || 'Unknown Author',
                authorPhotoURL: data.authorPhotoURL || '',
                content: data.content || '',
                attachments: Array.isArray(data.attachments) ? data.attachments.filter(
                    (att: any): att is Attachment =>
                        att && typeof att.name === 'string' && typeof att.url === 'string' &&
                        ['link', 'file', 'image'].includes(att.type)
                ) : [],
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
            };
            return updateData as ProjectUpdate;
        });

        console.log(`Found ${updates.length} updates for project ${projectId}.`);
        return NextResponse.json({ updates });

    } catch (error: any) {
        console.error(`❌ GET /updates Error for project ${projectId}:`, error);
        if (error.message?.includes("Project ID missing or invalid")) {
            return NextResponse.json({ error: "Invalid Project ID format provided." }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to fetch project updates", details: error.message }, { status: 500 });
    }
}


// --- POST Handler: Create a New Update (Accepts and Validates Attachments) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const projectId = params.projectId;
    console.log(`--- POST /api/projects/${projectId}/updates ---`);
    try {
        // --- Initialization Check ---
        if (!firestore || !adminAuth) {
            throw new Error("Firestore or Admin Auth not initialized.");
        }
        // --- Project ID Validation ---
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
             return NextResponse.json({ error: "Project ID missing or invalid" }, { status: 400 });
        }

        // 1. --- Verify Authentication ---
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
            return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
        }
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ Token verification failed:", authError);
             const detail = authError.code === 'auth/id-token-expired' ? 'Token expired.' : authError.message;
             return NextResponse.json({ error: "Unauthorized: Invalid token", details: detail }, { status: 403 });
        }
        const uid = decodedToken.uid;
        const userName = decodedToken.name || "Anonymous User";
        const userPhoto = decodedToken.picture || "";

        // 2. --- Verify Ownership ---
        const projectRef = getProjectRef(projectId);
        const projectSnap = await projectRef.get();
        if (!projectSnap.exists) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        if (projectSnap.data()?.creatorId !== uid) {
            console.warn(`User ${uid} attempted update on project ${projectId} owned by ${projectSnap.data()?.creatorId}`);
            return NextResponse.json({ error: "Forbidden: Only the project owner can post updates" }, { status: 403 });
        }

        // 3. --- Parse Request Body ---
        let body;
        try {
             body = await request.json();
        } catch (parseError) {
             return NextResponse.json({ error: "Invalid request body: Failed to parse JSON." }, { status: 400 });
        }
        const { content, attachments } = body;

        // 4. --- Validate Input ---
        if (!content || typeof content !== 'string' || content.trim() === '') {
            return NextResponse.json({ error: "Update content cannot be empty" }, { status: 400 });
        }
        let validAttachments: Attachment[] = [];
        if (attachments) {
            if (Array.isArray(attachments)) {
                validAttachments = attachments.filter(
                    (att: any): att is Attachment =>
                        att && typeof att.name === 'string' && att.name.trim() !== '' &&
                        typeof att.url === 'string' && att.url.trim() !== '' &&
                        typeof att.type === 'string' && ['link', 'file', 'image'].includes(att.type)
                );
                console.log(`Validated ${validAttachments.length} out of ${attachments.length} provided attachments.`);
                if(validAttachments.length < attachments.length){
                    console.warn("Some attachments were invalid and ignored.");
                }
            } else {
                 console.warn("Received 'attachments' but it wasn't an array. Ignoring.");
            }
        }

        // 5. --- Prepare Update Data ---
        const newUpdateData: Omit<ProjectUpdate, 'id' | 'createdAt'> = {
            authorId: uid,
            authorName: userName,
            authorPhotoURL: userPhoto,
            content: content.trim(),
            attachments: validAttachments,
        };

        // 6. --- Add Update to Subcollection ---
        const updatesCollectionRef = projectRef.collection('updates');
        const docRef = await updatesCollectionRef.add({
            ...newUpdateData,
            createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`Update ${docRef.id} added with ${validAttachments.length} attachments.`);

        // 7. --- Optionally: Update project's 'updatedAt' timestamp ---
        // This section correctly updates the main project document's timestamp
        try {
            await projectRef.update({
                 updatedAt: FieldValue.serverTimestamp(), // Update the timestamp
                 // Optionally update lastUpdateSummary if needed
                 // lastUpdateSummary: content.trim().substring(0, 100) + (content.trim().length > 100 ? '...' : '')
            });
             console.log(`Project ${projectId} 'updatedAt' timestamp updated.`);
        } catch (updateError) {
             console.error(`Failed to update project timestamp for ${projectId}:`, updateError);
             // Log the error but don't fail the request as the update itself succeeded
        }
        // --- End Step 7 ---

        // 8. --- Return Success Response ---
        return NextResponse.json(
             { message: "Update posted successfully", updateId: docRef.id },
             { status: 201 } // HTTP 201 Created
        );

    } catch (error: any) {
        console.error(`❌ POST /updates Error for project ${projectId}:`, error);
         if (error.message?.includes("Project ID missing or invalid")) {
            return NextResponse.json({ error: "Invalid Project ID format provided." }, { status: 400 });
        }
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json({ error: "Failed to post update", details: errorMessage }, { status: 500 });
    }
}