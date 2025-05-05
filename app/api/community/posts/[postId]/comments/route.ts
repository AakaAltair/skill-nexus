// app/api/community/posts/[postId]/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Adjust path as needed
import { CommunityComment } from '@/lib/types/community'; // Adjust path as needed
import admin from 'firebase-admin'; // Import the admin namespace

const POSTS_COLLECTION_NAME = 'feedPosts'; // Ensure this matches your actual collection name
const COMMENTS_SUBCOLLECTION_NAME = 'comments'; // Standard subcollection name

// --- Helper Function to Authenticate User ---
// (Ensure this helper is accurate or move to shared lib)
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Authentication required', status: 401 };
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const user = {
      uid: decodedToken.uid,
      name: decodedToken.name || 'Anonymous',
      photoURL: decodedToken.picture || null,
    };
    return { user, error: null, status: 200 };
  } catch (error) {
    console.error('API Route: Error verifying ID token:', error);
    return { user: null, error: 'Invalid or expired token', status: 401 };
  }
}

// --- GET /api/community/posts/[postId]/comments ---
export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const { postId } = params;
  if (!postId) {
      return NextResponse.json({ message: 'Post ID is required' }, { status: 400 });
  }

  try {
    const postRef = firestore.collection(POSTS_COLLECTION_NAME).doc(postId);
    const postSnapshot = await postRef.get();
    if (!postSnapshot.exists) {
       return NextResponse.json({ message: 'Parent post not found' }, { status: 404 });
    }

    const commentsQuery = postRef.collection(COMMENTS_SUBCOLLECTION_NAME)
      .orderBy('createdAt', 'asc');

    const snapshot = await commentsQuery.get();
    const comments: CommunityComment[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityComment));

    return NextResponse.json({ comments }, { status: 200 });

  } catch (error) {
    console.error(`API Route: Error fetching comments for post ${postId}:`, error);
    return NextResponse.json({ message: 'Failed to fetch comments', error: (error as Error).message }, { status: 500 });
  }
}


// --- POST /api/community/posts/[postId]/comments ---
export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const { postId } = params;
  if (!postId) {
      console.error("API Route: POST comment request missing postId.");
      return NextResponse.json({ message: 'Post ID is required' }, { status: 400 });
  }

  // 1. Authenticate User
  const authResult = await authenticateUser(req);
  if (authResult.error || !authResult.user) {
    console.warn(`API Route: Authentication failed for POST comment on ${postId}. Reason: ${authResult.error}`);
    return NextResponse.json({ message: authResult.error }, { status: authResult.status });
  }
  const user = authResult.user;
  console.log(`API Route: User ${user.uid} attempting to post comment on ${postId}`);

  try {
    // 2. Parse and Validate Request Body
    let body;
    try {
        body = await req.json();
    } catch (parseError) {
        console.error(`API Route: Failed to parse request body for POST comment on ${postId}:`, parseError);
        return NextResponse.json({ message: 'Invalid request body: Failed to parse JSON.' }, { status: 400 });
    }

    const { text, parentId } = body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn(`API Route: Validation failed for POST comment on ${postId}: Text is required.`);
      return NextResponse.json({ message: 'Comment text is required and cannot be empty' }, { status: 400 });
    }
    if (parentId && typeof parentId !== 'string') {
        console.warn(`API Route: Validation failed for POST comment on ${postId}: Invalid parentId format.`);
      return NextResponse.json({ message: 'Invalid parentId format' }, { status: 400 });
    }
    if (text.length > 1000) { // Example length limit
        console.warn(`API Route: Validation failed for POST comment on ${postId}: Text exceeds limit.`);
        return NextResponse.json({ message: 'Comment text exceeds maximum length (1000 characters)' }, { status: 400 });
    }
    console.log(`API Route: Comment data validated for post ${postId}. ParentId: ${parentId || 'None'}`);

    const postRef = firestore.collection(POSTS_COLLECTION_NAME).doc(postId);
    const newCommentRef = postRef.collection(COMMENTS_SUBCOLLECTION_NAME).doc(); // Get ref for new comment

    // 3. Prepare New Comment Data
    const newCommentData: Omit<CommunityComment, 'id'> = {
      postId: postId,
      creatorId: user.uid,
      creatorName: user.name, // Ensure these are reliably sourced from token
      creatorPhotoURL: user.photoURL, // Ensure these are reliably sourced from token
      createdAt: admin.firestore.Timestamp.now(),
      text: text.trim(),
      parentId: parentId || null,
      // Add any other default fields for comments if necessary
    };

    // 4. Run Firestore Transaction
    console.log(`API Route: Starting transaction for comment on ${postId}`);
    await firestore.runTransaction(async (transaction) => {
      const postSnapshot = await transaction.get(postRef);

      if (!postSnapshot.exists) {
        console.warn(`API Route: Transaction aborted for comment on ${postId}: Parent post not found.`);
        throw new Error('Parent post not found'); // Aborts transaction
      }
      console.log(`API Route: Parent post ${postId} found within transaction.`);

      // Add the new comment document
      transaction.set(newCommentRef, newCommentData);
      console.log(`API Route: New comment ${newCommentRef.id} set within transaction for post ${postId}.`);

      // Safely Increment the commentCount on the parent post
      const postData = postSnapshot.data() ?? {};
      const currentCommentCount = typeof postData.commentCount === 'number' ? postData.commentCount : 0;
      transaction.update(postRef, {
        commentCount: currentCommentCount + 1,
        // Optional: Also update an 'updatedAt' or 'lastCommentAt' field on the post?
        // updatedAt: admin.firestore.Timestamp.now(),
      });
       console.log(`API Route: commentCount incremented to ${currentCommentCount + 1} for post ${postId} within transaction.`);

    }); // Transaction commits here if no errors were thrown
    console.log(`API Route: Transaction successful for comment ${newCommentRef.id} on post ${postId}.`);

    // 5. Return Success Response
    return NextResponse.json({ message: 'Comment added successfully', commentId: newCommentRef.id }, { status: 201 });

  } catch (error: unknown) { // Catch unknown type
    console.error(`API Route: Unexpected error adding comment to post ${postId}:`, error);

    // Handle specific transaction errors explicitly
    if (error instanceof Error && error.message === 'Parent post not found') {
      return NextResponse.json({ message: 'Cannot add comment: Parent post does not exist.' }, { status: 404 });
    }
    // Handle potential Firestore errors (e.g., permission denied)
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const firestoreError = error as { code: string; message: string };
        if (firestoreError.code === 'permission-denied') {
             console.warn(`API Route: Permission denied for comment on ${postId}. Check Firestore rules.`);
             return NextResponse.json({ message: 'Permission denied to add comment or update post.' }, { status: 403 });
        }
        // Log other Firestore error codes if needed
        console.error(`API Route: Firestore error code: ${firestoreError.code}, message: ${firestoreError.message}`);
    }

    // Generic server error for anything else
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ message: 'Failed to add comment', error: errorMessage }, { status: 500 });
  }
}

// --- DELETE handler (Placeholder - Add if needed) ---
// export async function DELETE(req: NextRequest, { params }: { params: { postId: string, commentId: string } }) { ... }