// app/api/projects/[projectId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore,
    adminAuth
} from '@/lib/firebaseAdmin'; // Your initialized admin instances
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import necessary types/helpers
import { Project } from '@/lib/types/project'; // Import your Project type

// Helper function to get Document Reference
function getProjectRef(projectId: string): FirebaseFirestore.DocumentReference {
    if (!firestore) throw new Error("Firestore not initialized.");
    // Add check for non-empty string
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
        throw new Error("Project ID is invalid or missing.");
    }
    return firestore.collection('projects').doc(projectId);
}

// --- GET Handler: Fetch Single Project ---
export async function GET(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    // Log safely using optional chaining on params at the start
    console.log(`--- GET /api/projects/${params?.projectId || 'undefined'} ---`);
    try {
        // Access and validate projectId inside the try block
        const projectId = params.projectId;
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
            return NextResponse.json({ error: "Project ID is invalid or missing" }, { status: 400 });
        }

        if (!firestore) { // Check firestore init status
             throw new Error("Firestore not initialized.");
        }

        const projectRef = getProjectRef(projectId); // Use validated projectId
        const docSnap = await projectRef.get(); // Use .get() for Admin SDK

        if (!docSnap.exists) {
            console.log(`Project ${projectId} not found.`);
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const data = docSnap.data()!; // Use non-null assertion after exists check

        // Map Firestore data to Project type, converting Timestamps
        const projectData: Project = {
            id: docSnap.id,
            title: data.title || 'Untitled Project',
            description: data.description || '',
            creatorId: data.creatorId || '',
            creatorName: data.creatorName || 'Unknown Creator',
            creatorPhotoURL: data.creatorPhotoURL || '',
            projectType: data.projectType || 'Other',
            status: data.status || 'Idea',
            skills: Array.isArray(data.skills) ? data.skills : [],
            techStack: data.techStack || '',
            members: Array.isArray(data.members) ? data.members : [],
            lookingForMembers: data.lookingForMembers || false,
            rolesNeeded: Array.isArray(data.rolesNeeded) ? data.rolesNeeded : [],
            coverImageURL: data.coverImageURL || '',
            projectLink: data.projectLink || '',
            repoLink: data.repoLink || '',
            lastUpdateSummary: data.lastUpdateSummary || '',
            location: data.location || '', // Include location mapping
             // Safely access .toDate() and convert to ISO string
             createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
             updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
        };

        console.log(`Project ${projectId} found.`);
        return NextResponse.json({ project: projectData as Project }); // Return typed project data

    } catch (error: any) {
        console.error(`❌ GET /api/projects/${params?.projectId} Error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json( { error: "Failed to fetch project details", details: errorMessage }, { status: 500 });
    }
}

// --- PATCH Handler: Update Project ---
export async function PATCH(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
     console.log(`--- PATCH /api/projects/${params?.projectId || 'undefined'} ---`);
     try {
        // Access projectId INSIDE the try block
        const projectId = params.projectId;
         if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
            return NextResponse.json({ error: "Project ID is invalid or missing" }, { status: 400 });
        }

        if (!firestore || !adminAuth) throw new Error("Firestore/Auth not initialized.");

        // 1. Verify Auth & Ownership
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) return NextResponse.json({ error: "Unauthorized: No token" }, { status: 401 });
        let decodedToken; try { decodedToken = await adminAuth.verifyIdToken(idToken); } catch (authError: any) { return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 }); }
        const uid = decodedToken.uid;

        // 2. Fetch & Verify Ownership
        const projectRef = getProjectRef(projectId);
        const docSnap = await projectRef.get();
        if (!docSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });
        const existingData = docSnap.data();
        if (existingData?.creatorId !== uid) return NextResponse.json({ error: "Forbidden: Not owner" }, { status: 403 });

        // 3. Parse Body
        const body = await request.json();

        // 4. Construct Update Data
        const updateData: { [key: string]: any } = {};
        const allowedFields: (keyof Project)[] = [ 'title', 'description', 'projectType', 'status', 'skills', 'techStack', 'members', 'lookingForMembers', 'rolesNeeded', 'coverImageURL', 'projectLink', 'repoLink', 'location' ];
        let hasUpdate = false;
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                // Add validation here if needed
                updateData[field] = body[field];
                hasUpdate = true;
            }
        }
        if (!hasUpdate) return NextResponse.json({ error: "No valid fields for update" }, { status: 400 });
        updateData.updatedAt = FieldValue.serverTimestamp();

        // 5. Update Document
        await projectRef.update(updateData);
        console.log(`API PATCH /api/projects/${projectId}: Project updated by ${uid}`);
        return NextResponse.json({ message: "Project updated successfully" });

    } catch (error: any) {
        console.error(`❌ PATCH /api/projects/${params?.projectId} Error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json( { error: "Failed to update project", details: errorMessage }, { status: 500 });
    }
}

// --- DELETE Handler: Delete Project ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectId: string } }
) {
    console.log(`--- DELETE /api/projects/${params?.projectId || 'undefined'} ---`);
    try {
        // Access projectId INSIDE the try block
        const projectId = params.projectId;
         if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
            return NextResponse.json({ error: "Project ID is invalid or missing" }, { status: 400 });
        }

        if (!firestore || !adminAuth) throw new Error("Firestore/Auth not initialized.");

        // 1. Verify Auth & Ownership
         const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
         if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
         let decodedToken; try { decodedToken = await adminAuth.verifyIdToken(idToken); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 403 }); }
         const uid = decodedToken.uid;

         // 2. Fetch & Verify Ownership
         const projectRef = getProjectRef(projectId);
         const docSnap = await projectRef.get();
         if (!docSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });
         if (docSnap.data()?.creatorId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

         // 3. Delete Document
         await projectRef.delete();
         console.log(`API DELETE /api/projects/${projectId}: Project deleted by ${uid}`);
         return new NextResponse(null, { status: 204 }); // Standard success for DELETE

    } catch (error: any) {
        console.error(`❌ DELETE /api/projects/${params?.projectId} Error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error.";
        return NextResponse.json( { error: "Failed to delete project", details: errorMessage }, { status: 500 });
    }
}