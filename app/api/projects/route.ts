// app/api/projects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore,
    adminAuth
} from '@/lib/firebaseAdmin'; // Your initialized admin instances
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; // Import only necessary types/helpers
import { Project, ProjectMember, ProjectType, ProjectStatus } from '@/lib/types/project'; // Import your types

// --- GET Handler: List Projects ---
export async function GET(request: NextRequest) {
    console.log('--- GET /api/projects ---');
    try {
        if (!firestore) {
            throw new Error("Firestore not initialized.");
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const limitParam = parseInt(searchParams.get('limit') || '20', 10);

        console.log(`userId filter: ${userId || 'None'}, limit: ${limitParam}`);

        const projectsCollectionRef = firestore.collection('projects');
        let queryRef: FirebaseFirestore.Query = projectsCollectionRef; // Base query, typed explicitly

        if (userId) {
            queryRef = queryRef.where('creatorId', '==', userId);
            console.log(`Applying filter for creatorId: ${userId}`);
        }

        queryRef = queryRef.orderBy('createdAt', 'desc').limit(limitParam);
        const querySnapshot = await queryRef.get();

        // Map Firestore documents to Project type
        const projects = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const projectData: Project = {
                id: doc.id,
                title: data.title || 'Untitled',
                description: data.description || '',
                creatorId: data.creatorId || '',
                creatorName: data.creatorName || 'Unknown',
                creatorPhotoURL: data.creatorPhotoURL || '',
                projectType: data.projectType || 'Other',
                status: data.status || 'Idea',
                skills: Array.isArray(data.skills) ? data.skills : [],
                techStack: data.techStack || '', // Use empty string fallback
                members: Array.isArray(data.members) ? data.members : [],
                lookingForMembers: data.lookingForMembers || false, // Use boolean fallback
                rolesNeeded: Array.isArray(data.rolesNeeded) ? data.rolesNeeded : [],
                coverImageURL: data.coverImageURL || '', // Use empty string fallback
                projectLink: data.projectLink || '', // Use empty string fallback
                repoLink: data.repoLink || '', // Use empty string fallback
                lastUpdateSummary: data.lastUpdateSummary || '', // Use empty string fallback
                location: data.location || '', // Use empty string fallback
                // Convert Timestamps to ISO strings
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
            };
            return projectData as Project; // Ensure the final object conforms
        });

        console.log(`API GET /api/projects: Found ${projects.length} projects (filter: ${userId ? userId : 'All'}).`);
        return NextResponse.json({ projects });

    } catch (error: any) {
        console.error("❌ GET /api/projects Error:", error);
        // Provide specific message if known, otherwise generic
        const errorMessage = error.message || "Internal server error during fetch.";
        return NextResponse.json({ error: "Failed to fetch projects", details: errorMessage }, { status: 500 });
    }
}

// --- POST Handler: Create Project ---
export async function POST(request: NextRequest) {
    console.log('--- POST /api/projects ---');
    try {
        if (!firestore || !adminAuth) {
            throw new Error("Firestore or Admin Auth not initialized.");
        }

        // 1. Verify Authentication
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
             console.warn("POST /api/projects: Unauthorized - No token");
             return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ POST /api/projects: Token verification failed:", authError.code, authError.message);
             return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid;

        // 2. Get Creator Info from Token (Consider fetching latest if needed)
        let creatorName = decodedToken.name || "Anonymous";
        let creatorPhotoURL = decodedToken.picture || "";


        // 3. Parse and Validate Request Body
        const body = await request.json();
        // ---- Log received body ----
        console.log("Received POST body:", JSON.stringify(body, null, 2)); // Pretty print JSON

        // Basic validation (expand as needed)
        if (!body.title || !body.description || !body.projectType || !body.status || !Array.isArray(body.skills) || body.skills.length === 0) {
            console.warn("POST /api/projects: Validation failed - Missing required fields.");
            return NextResponse.json({ error: "Missing required project fields (title, description, projectType, status, skills)" }, { status: 400 });
        }

        // 4. Construct New Project Data (excluding id, Timestamps)
        const newProjectBaseData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
            title: body.title,
            description: body.description,
            creatorId: uid,
            creatorName: creatorName,
            creatorPhotoURL: creatorPhotoURL,
            projectType: body.projectType as ProjectType, // Trust client for now, add validation if needed
            status: body.status as ProjectStatus, // Trust client for now, add validation if needed
            skills: body.skills, // Already validated as array above
            techStack: body.techStack || '',
            members: [{ userId: uid, name: creatorName, photoURL: creatorPhotoURL }], // Start with creator
            lookingForMembers: body.lookingForMembers || false,
            rolesNeeded: Array.isArray(body.rolesNeeded) ? body.rolesNeeded : [],
            coverImageURL: body.coverImageURL || '',
            projectLink: body.projectLink || '',
            repoLink: body.repoLink || '',
            lastUpdateSummary: '', // Initialize empty
            location: body.location || '', // Assign location, default to empty string
        };

        // ---- Log data being saved ----
        console.log("Data prepared for Firestore (excluding timestamps):", JSON.stringify(newProjectBaseData, null, 2));


        // 5. Add Document to Firestore with Server Timestamps
        const projectsCollectionRef = firestore.collection('projects');
        const docRef = await projectsCollectionRef.add({
            ...newProjectBaseData,
            createdAt: FieldValue.serverTimestamp(), // Admin SDK server timestamp
            updatedAt: FieldValue.serverTimestamp(), // Admin SDK server timestamp
        });

        console.log(`API POST /api/projects: Project created ID: ${docRef.id} by user ${uid}`);

        // 6. Return Success Response
        return NextResponse.json(
            { message: "Project created successfully", projectId: docRef.id },
            { status: 201 } // 201 Created status
        );

    } catch (error: any) {
        console.error("❌ POST /api/projects Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An internal server error occurred while creating project.";
        // Log stack trace for server errors
        if (error instanceof Error && error.stack) {
            console.error("Stack Trace:", error.stack);
        }
        return NextResponse.json(
            { error: "Failed to create project", details: errorMessage },
            { status: 500 }
        );
    }
}