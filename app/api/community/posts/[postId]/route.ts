// app/api/community/posts/[postId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Adjust path as needed
import { CommunityPost } from '@/lib/types/community'; // Adjust path as needed
import admin from 'firebase-admin'; // Import the admin namespace

const COLLECTION_NAME = 'feedPosts'; // Use the collection name from your rules

// Helper function to verify token and get user info (Copied for now, ideally shared)
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Authentication required' };
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const user = {
      uid: decodedToken.uid,
      name: decodedToken.name || 'Anonymous',
      photoURL: decodedToken.picture || null,
      email: decodedToken.email,
    };
    return { user, error: null };
  } catch (error) {
    console.error('Error verifying ID token:', error);
    return { user: null, error: 'Invalid or expired token' };
  }
}


// --- GET /api/community/posts/[postId] ---
// Fetch a single community post by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } } // Get the postId from the URL params
) {
  const { postId } = params;

  try {
    const docRef = firestore.collection(COLLECTION_NAME).doc(postId);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    }

    const postData = docSnapshot.data();
    // Convert Firestore Timestamp if necessary, similar to the GET /posts route
    const post: CommunityPost = {
      id: docSnapshot.id,
      ...postData,
    } as CommunityPost; // Cast for type safety

    return NextResponse.json({ post }, { status: 200 });

  } catch (error) {
    console.error(`Error fetching community post ${postId}:`, error);
    return NextResponse.json({ message: `Failed to fetch community post ${postId}`, error: (error as Error).message }, { status: 500 });
  }
}


// --- PATCH /api/community/posts/[postId] ---
// Update a community post (requires ownership)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const { postId } = params;

  // Authenticate user
  const { user, error: authError } = await authenticateUser(req);
  if (authError || !user) {
    return NextResponse.json({ message: authError || 'Authentication failed' }, { status: 401 });
  }

  try {
    const docRef = firestore.collection(COLLECTION_NAME).doc(postId);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    }

    const postData = docSnapshot.data() as CommunityPost; // Cast for ownership check

    // Ownership check (backend check reinforcing security rules)
    if (postData.creatorId !== user.uid) {
      return NextResponse.json({ message: 'Unauthorized to update this post' }, { status: 403 });
    }

    const dataToUpdate = await req.json();

    // Basic Validation for updateable fields
    const allowedUpdateFields = ['textContent', 'mediaUrls', 'linkUrl', 'isEvent', 'eventDetails', 'categories']; // Fields allowed to be updated by creator
    const updatePayload: any = {};

    for (const field of allowedUpdateFields) {
        if (dataToUpdate.hasOwnProperty(field)) {
            // Add validation for each field type/format here if needed
            if (field === 'textContent' && (typeof dataToUpdate[field] !== 'string' || dataToUpdate[field].trim() === '')) {
                 return NextResponse.json({ message: 'Text content cannot be empty' }, { status: 400 });
            }
             if (field === 'mediaUrls' && dataToUpdate[field] !== null && !Array.isArray(dataToUpdate[field])) {
                return NextResponse.json({ message: 'mediaUrls must be an array or null' }, { status: 400 });
             }
              if (field === 'isEvent' && typeof dataToUpdate[field] !== 'boolean') {
                 return NextResponse.json({ message: 'isEvent must be a boolean' }, { status: 400 });
             }
             if (field === 'eventDetails' && dataToUpdate[field] !== null && typeof dataToUpdate[field] !== 'object') {
                 return NextResponse.json({ message: 'eventDetails must be an object or null' }, { status: 400 });
             }
              if (field === 'categories' && dataToUpdate[field] !== null && !Array.isArray(dataToUpdate[field])) {
                 return NextResponse.json({ message: 'categories must be an array or null' }, { status: 400 });
             }


            updatePayload[field] = dataToUpdate[field];
        }
    }

    // Add/Update hasMedia flag if mediaUrls is being updated
    if (dataToUpdate.hasOwnProperty('mediaUrls')) {
         updatePayload['hasMedia'] = dataToUpdate.mediaUrls && Array.isArray(dataToUpdate.mediaUrls) && dataToUpdate.mediaUrls.length > 0;
    }
     // Convert eventDetails.date to Timestamp if isEvent and eventDetails are being updated
     if (dataToUpdate.hasOwnProperty('isEvent') && dataToUpdate.isEvent && updatePayload.eventDetails && updatePayload.eventDetails.date) {
          updatePayload.eventDetails.date = admin.firestore.Timestamp.fromMillis(new Date(updatePayload.eventDetails.date).getTime());
     } else if (dataToUpdate.hasOwnProperty('isEvent') && !dataToUpdate.isEvent) {
         // If switching to non-event, ensure eventDetails is null
         updatePayload.eventDetails = null;
     }


    // Add updated timestamp
    updatePayload.updatedAt = admin.firestore.Timestamp.now();

    // Perform the update
    await docRef.update(updatePayload);

    return NextResponse.json({ message: `Post ${postId} updated successfully` }, { status: 200 });

  } catch (error) {
    console.error(`Error updating community post ${postId}:`, error);
    return NextResponse.json({ message: `Failed to update community post ${postId}`, error: (error as Error).message }, { status: 500 });
  }
}


// --- DELETE /api/community/posts/[postId] ---
// Delete a community post (requires ownership)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const { postId } = params;

  // Authenticate user
  const { user, error: authError } = await authenticateUser(req);
  if (authError || !user) {
    return NextResponse.json({ message: authError || 'Authentication failed' }, { status: 401 });
  }

  try {
    const docRef = firestore.collection(COLLECTION_NAME).doc(postId);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      return NextResponse.json({ message: 'Post not found' }, { status: 404 });
    }

    const postData = docSnapshot.data() as CommunityPost; // Cast for ownership check

    // Ownership check (backend check reinforcing security rules)
    if (postData.creatorId !== user.uid) {
      return NextResponse.json({ message: 'Unauthorized to delete this post' }, { status: 403 });
    }

    // --- IMPORTANT: CLEANUP ---
    // When deleting a post, you should also delete:
    // 1. All documents in its subcollections (comments, likes).
    // 2. Any associated files in Firebase Storage (when implemented).
    // Deleting subcollections is NOT automatic in Firestore.
    // Deleting files in Storage is also NOT automatic.
    // The most robust way to handle this is using a Firebase Cloud Function
    // triggered by the document deletion (onDocumentDelete).
    // Example:
    // exports.deleteCommunityPostCleanup = functions.firestore
    //   .document('feedPosts/{postId}')
    //   .onDelete(async (snapshot, context) => {
    //     const { postId } = context.params;
    //     // 1. Delete subcollections (comments, likes)
    //     const commentsRef = snapshot.ref.collection('comments');
    //     const likesRef = snapshot.ref.collection('likes');
    //     // Use batched writes or deleteCollection helper (from firebase-admin/firestore)
    //     await deleteCollection(commentsRef, 10); // Delete in batches of 10
    //     await deleteCollection(likesRef, 10);
    //     // 2. Delete Storage files (when implemented)
    //     // You'd need to know the Storage paths, maybe stored in the post document or via metadata.
    //     // const storage = admin.storage();
    //     // const bucket = storage.bucket('YOUR_STORAGE_BUCKET_URL');
    //     // const filesToDelete = postData.mediaPaths; // Assuming you store paths
    //     // await Promise.all(filesToDelete.map(filePath => bucket.file(filePath).delete()));
    //   });
    // For now, we'll just delete the main document via the API. The subcollections
    // and Storage files will be orphaned unless a Cloud Function handles cleanup.

    // Delete the main post document
    await docRef.delete();

    return NextResponse.json({ message: `Post ${postId} deleted successfully` }, { status: 200 });

  } catch (error) {
    console.error(`Error deleting community post ${postId}:`, error);
    return NextResponse.json({ message: `Failed to delete community post ${postId}`, error: (error as Error).message }, { status: 500 });
  }
}

// Helper function for Cloud Functions cleanup (if you decide to use it later)
// This is *not* part of the Next.js API route, but shown for context.
/*
async function deleteCollection(collectionRef: admin.firestore.CollectionReference | admin.firestore.Query, batchSize: number) {
    const query = collectionRef.limit(batchSize);
    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query: admin.firestore.Query, resolve: (value?: unknown) => void) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
        resolve();
        return;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}
*/