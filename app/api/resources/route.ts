// app/api/resources/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
    firestore, // Import firestore directly (as exported by your firebaseAdmin.ts)
    adminAuth  // Import adminAuth directly
} from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue, Query } from 'firebase-admin/firestore'; // Import Query type
import { Resource, ResourceType } from '@/lib/types/resource'; // Import resource types

// --- GET Handler: List Resources (Handles 'All' and 'My Resources' via userId) ---
export async function GET(request: NextRequest) {
    console.log('--- GET /api/resources ---');
    try {
        // Check if firestore instance is available
        if (!firestore) {
            throw new Error("Firestore not initialized.");
        }

        const { searchParams } = new URL(request.url);
        // Get userId query parameter for filtering
        const userId = searchParams.get('userId');
        // Get limit query parameter (optional)
        const limitParam = parseInt(searchParams.get('limit') || '50', 10); // Default limit

        console.log(`API GET /api/resources - Request Params: userId=${userId || 'None'}, limit=${limitParam}`);

        const resourcesCollectionRef = firestore.collection('resources');
        // Explicitly type the query variable using the imported Query type
        let queryRef: Query = resourcesCollectionRef;

        // Apply filter if userId is provided
        if (userId) {
            // Filter by the 'uploaderId' field
            queryRef = queryRef.where('uploaderId', '==', userId);
            console.log(`Applying filter for uploaderId: ${userId}`);
        }

        // Apply default sorting (newest first) and limit
        queryRef = queryRef.orderBy('createdAt', 'desc').limit(limitParam);

        const querySnapshot = await queryRef.get();

        // Map Firestore documents to Resource type with proper defaults
        const resources = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const createdAtTs = data.createdAt as Timestamp; // Assert type for conversion
            const updatedAtTs = data.updatedAt as Timestamp; // Assert type for conversion (optional)

            // Construct the Resource object
            const resourceData: Resource = {
                id: doc.id,
                title: data.title || 'Untitled Resource',
                description: data.description || '',
                linkURL: data.linkURL || '', // Should exist if created properly
                resourceType: data.resourceType || 'Other',
                branch: data.branch || '',
                year: data.year || '',
                college: data.college || '',
                subject: data.subject || '',
                uploaderId: data.uploaderId || '', // Should exist
                uploaderName: data.uploaderName || 'Anonymous',
                uploaderPhotoURL: data.uploaderPhotoURL || '/default-avatar.png', // Default avatar
                tags: Array.isArray(data.tags) ? data.tags : [],
                commentsEnabled: data.commentsEnabled !== false, // Default true if undefined/null
                // Convert Firestore Timestamps to ISO strings for JSON serialization
                createdAt: createdAtTs?.toDate ? createdAtTs.toDate().toISOString() : new Date(0).toISOString(),
                updatedAt: updatedAtTs?.toDate ? updatedAtTs.toDate().toISOString() : (createdAtTs?.toDate ? createdAtTs.toDate().toISOString() : new Date(0).toISOString()), // Fallback updatedAt to createdAt
            };
            return resourceData;
        });

        console.log(`API GET /api/resources: Found ${resources.length} resources (filter: ${userId ? userId : 'All'}).`);
        // Return in the format { resources: [...] } to match project route
        return NextResponse.json({ resources });

    } catch (error: any) {
        console.error("❌ GET /api/resources Error:", error);
        const errorMessage = error.message || "Internal server error during fetch.";
        // Match project route error format
        return NextResponse.json({ error: "Failed to fetch resources", details: errorMessage }, { status: 500 });
    }
}


// --- POST Handler: Create Resource (No File Upload, Uses Link URL) ---
export async function POST(request: NextRequest) {
    console.log('--- POST /api/resources ---');
    try {
        // Check if firestore and adminAuth instances are available
        if (!firestore || !adminAuth) {
            throw new Error("Firestore or Admin Auth not initialized.");
        }

        // 1. Verify Authentication (using adminAuth directly)
        const idToken = request.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
             console.warn("POST /api/resources: Unauthorized - No token");
             return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
        }

        let decodedToken;
        try {
            // Use the imported adminAuth instance to verify
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
             console.error("❌ POST /api/resources: Token verification failed:", authError.code, authError.message);
             // Match project route error format
             return NextResponse.json({ error: "Unauthorized: Invalid token", details: authError.message }, { status: 403 });
        }
        const uid = decodedToken.uid;
        console.log(`Authenticated user for POST: ${uid} (${decodedToken.name || 'No Name'})`);

        // 2. Get Uploader Info from Token
        const uploaderName = decodedToken.name || "Anonymous"; // Default if name isn't in token
        const uploaderPhotoURL = decodedToken.picture || "/default-avatar.png"; // Default avatar

        // 3. Parse JSON Request Body
        const body = await request.json();
        console.log("Received POST body (JSON):", JSON.stringify(body, null, 2));

        // 4. Validate Input Data (Metadata & Link URL)
        if (!body.title || !body.linkURL || !body.resourceType) {
            console.warn("POST /api/resources: Validation failed - Missing required fields.");
            // Match project route error format
            return NextResponse.json({ error: 'Missing required fields: title, linkURL, and resourceType are required.' }, { status: 400 });
        }
        // Basic URL validation on backend
         try {
            new URL(body.linkURL); // Check if it parses as a URL
         } catch (_) {
             console.warn("POST /api/resources: Validation failed - Invalid linkURL format.");
             // Match project route error format
             return NextResponse.json({ error: 'The provided URL format seems invalid.' }, { status: 400 });
         }
         // Basic check for ResourceType validity (can be expanded)
         if (typeof body.resourceType !== 'string' || body.resourceType.trim() === '') {
              console.warn("POST /api/resources: Validation failed - Invalid resourceType.");
              return NextResponse.json({ error: 'Invalid resourceType provided.' }, { status: 400 });
         }

        // File Upload Logic Removed - No steps 5 & 6 needed for this version

        // 5. Construct New Resource Data (using linkURL from body)
        // Ensure structure matches Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>
        // Explicitly set defaults for optional fields if not provided in body
        const newResourceBaseData: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'> = {
            title: body.title.trim(),
            description: body.description?.trim() || '', // Use trim or default empty
            linkURL: body.linkURL.trim(), // Use the validated linkURL
            resourceType: body.resourceType as ResourceType, // Assume valid type from check above
            branch: body.branch?.trim() || '',
            year: body.year?.trim() || '',
            college: body.college?.trim() || '',
            subject: body.subject?.trim() || '',
            uploaderId: uid, // From verified token
            uploaderName: uploaderName, // From verified token
            uploaderPhotoURL: uploaderPhotoURL, // From verified token
            tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [], // Ensure tags are non-empty strings
            commentsEnabled: true, // Default comments to enabled on creation
        };
        console.log("Data prepared for Firestore (excluding timestamps):", JSON.stringify(newResourceBaseData, null, 2));

        // 6. Add Document to Firestore with Server Timestamps
        const resourcesCollectionRef = firestore.collection('resources');
        const docRef = await resourcesCollectionRef.add({
            ...newResourceBaseData,
            createdAt: FieldValue.serverTimestamp(), // Admin SDK server timestamp
            updatedAt: FieldValue.serverTimestamp(), // Set updatedAt same as createdAt initially
        });

        console.log(`API POST /api/resources: Resource created ID: ${docRef.id} by user ${uid}`);

        // 7. Return Success Response (Matching project route format)
        // Use 'resourceId' for consistency if preferred, or 'projectId' if strictly matching
        return NextResponse.json(
            { message: "Resource created successfully", resourceId: docRef.id },
            { status: 201 } // 201 Created status
        );

    } catch (error: any) {
        console.error("❌ POST /api/resources Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An internal server error occurred while creating resource.";
        if (error instanceof Error && error.stack) {
            console.error("Stack Trace:", error.stack);
        }
        // Match project route error format
        return NextResponse.json(
            { error: "Failed to create resource", details: errorMessage },
            { status: 500 }
        );
    }
}