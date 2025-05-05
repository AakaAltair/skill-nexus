// app/api/community/posts/[postId]/likes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Adjust path as needed
import admin from 'firebase-admin'; // Import the admin namespace

const POSTS_COLLECTION_NAME = 'feedPosts'; // Parent collection name
const LIKES_SUBCOLLECTION_NAME = 'likes'; // Subcollection name

// Helper function to verify token and get user info (Move to a shared utility file!)
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


// --- POST /api/community/posts/[postId]/likes ---
// Add a like to a community post (requires authentication)
export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } } // Get the postId from the URL params
) {
  const { postId } = params;

  // Authenticate user
  const { user, error: authError } = await authenticateUser(req);
  if (authError || !user) {
    return NextResponse.json({ message: authError || 'Authentication failed' }, { status: 401 });
  }

  const postRef = firestore.collection(POSTS_COLLECTION_NAME).doc(postId);
  const userLikeRef = postRef.collection(LIKES_SUBCOLLECTION_NAME).doc(user.uid); // Like document ID is the user's UID

  try {
    // --- Use a Transaction to Add Like and Increment Count ---
    await firestore.runTransaction(async (transaction) => {
      // 1. Read the parent post document and the potential like document within the transaction
      const postSnapshot = await transaction.get(postRef);
      const userLikeSnapshot = await transaction.get(userLikeRef);

      if (!postSnapshot.exists) {
        throw new Error('Parent post not found'); // Abort transaction
      }

      if (userLikeSnapshot.exists) {
        // User has already liked this post. Abort the transaction gracefully
        // Throwing a specific error will let us return a 409 conflict response below
        throw new Error('Post already liked by this user');
      }

      // 2. Prepare the new like document data
      const newLikeData = {
        creatorId: user.uid, // Store creatorId for consistency, though doc ID is also UID
        likedAt: admin.firestore.Timestamp.now(), // Server timestamp for when the like occurred
      };

      // 3. Set the new like document within the transaction (document ID is user.uid)
      transaction.set(userLikeRef, newLikeData);

      // 4. Increment the likeCount on the parent post document within the transaction
      const currentLikeCount = postSnapshot.data()?.likeCount || 0;
      transaction.update(postRef, {
        likeCount: currentLikeCount + 1,
        updatedAt: admin.firestore.Timestamp.now(), // Optional: update parent post's updatedAt
      });

    }); // Transaction automatically commits on success or retries/rolls back on failure

    // If the transaction completed successfully
    return NextResponse.json({ message: 'Post liked successfully' }, { status: 201 });

  } catch (error) {
    console.error(`Error liking post ${postId} by user ${user.uid}:`, error);

    // Check for specific errors thrown within the transaction
    if ((error as Error).message === 'Parent post not found') {
         return NextResponse.json({ message: (error as Error).message }, { status: 404 });
    }
    if ((error as Error).message === 'Post already liked by this user') {
         return NextResponse.json({ message: (error as Error).message }, { status: 409 }); // 409 Conflict
    }

    return NextResponse.json({ message: `Failed to like post ${postId}`, error: (error as Error).message }, { status: 500 });
  }
}


// --- DELETE /api/community/posts/[postId]/likes ---
// Remove a like from a community post (requires authentication)
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

  const postRef = firestore.collection(POSTS_COLLECTION_NAME).doc(postId);
  const userLikeRef = postRef.collection(LIKES_SUBCOLLECTION_NAME).doc(user.uid); // Like document ID is the user's UID

  try {
    // --- Use a Transaction to Remove Like and Decrement Count ---
    await firestore.runTransaction(async (transaction) => {
      // 1. Read the parent post document and the potential like document within the transaction
      const postSnapshot = await transaction.get(postRef);
      const userLikeSnapshot = await transaction.get(userLikeRef);

      if (!postSnapshot.exists) {
        throw new Error('Parent post not found'); // Abort transaction
      }

      if (!userLikeSnapshot.exists) {
        // User has not liked this post. Abort the transaction gracefully
        throw new Error('Post not liked by this user');
      }

      // 2. Delete the like document within the transaction (document ID is user.uid)
      transaction.delete(userLikeRef);

      // 3. Decrement the likeCount on the parent post document within the transaction
      const currentLikeCount = postSnapshot.data()?.likeCount || 0;
       // Prevent count from going below zero, although logic should prevent this case
      const newLikeCount = Math.max(0, currentLikeCount - 1);
      transaction.update(postRef, {
        likeCount: newLikeCount,
        updatedAt: admin.firestore.Timestamp.now(), // Optional: update parent post's updatedAt
      });

    }); // Transaction automatically commits on success or retries/rolls back on failure

    // If the transaction completed successfully
    return NextResponse.json({ message: 'Post unliked successfully' }, { status: 200 });

  } catch (error) {
    console.error(`Error unliking post ${postId} by user ${user.uid}:`, error);

    // Check for specific errors thrown within the transaction
     if ((error as Error).message === 'Parent post not found') {
         return NextResponse.json({ message: (error as Error).message }, { status: 404 });
     }
     if ((error as Error).message === 'Post not liked by this user') {
         return NextResponse.json({ message: (error as Error).message }, { status: 409 }); // 409 Conflict
     }


    return NextResponse.json({ message: `Failed to unlike post ${postId}`, error: (error as Error).message }, { status: 500 });
  }
}

// No GET or PATCH needed at this specific route level for likes.
// Checking if a user has liked a post can be done by the client attempting to read
// the specific likes/{userId} document (if security rules allow) or by checking
// the existence of the like document when the card is rendered (less common).
// The simple read rule we added (allow read: if request.auth != null && request.auth.uid == userId;)
// is sufficient for the client to check if *they* liked it.