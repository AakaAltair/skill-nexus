// app/api/community/posts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firestore, adminAuth } from '@/lib/firebaseAdmin'; // Adjust path as needed
import { CommunityPost, COMMUNITY_POST_CATEGORIES } from '@/lib/types/community'; // Adjust path as needed
import admin from 'firebase-admin'; // Import the admin namespace for Timestamp/FieldValue

const COLLECTION_NAME = 'feedPosts'; // Use the collection name from your rules

// --- Helper function to verify token and get user info ---
// TODO: Move this to a shared utility file like lib/serverAuthUtils.ts
// It's duplicated across API routes, centralize it later.
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Authentication required', status: 401 };
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    // Extract desired user info from token
    const user = {
      uid: decodedToken.uid,
      name: decodedToken.name || 'Anonymous', // Use name from token if available
      photoURL: decodedToken.picture || null, // Use picture from token if available
      email: decodedToken.email, // Include email
    };
    return { user, error: null, status: 200 };
  } catch (error: unknown) {
    console.error('Error verifying ID token:', error);
     const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
     if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'auth/id-token-expired') {
          return { user: null, error: 'Authentication token expired', status: 401 };
     }
    return { user: null, error: 'Invalid or expired token', status: 401 };
  }
}

// --- GET /api/community/posts ---
// List community posts with filtering (by userId, category), sorting, and pagination.
// Requires authentication.
export async function GET(req: NextRequest) {
    console.log('--- GET /api/community/posts ---');

    // 1. Verify Authentication - Authentication is REQUIRED to view posts
    const authResult = await authenticateUser(req);
    if (authResult.error || !authResult.user) {
         console.warn(`GET /api/community/posts: Unauthorized attempt - ${authResult.error}`);
        return NextResponse.json({ message: authResult.error }, { status: authResult.status });
    }
    const currentUserId = authResult.user.uid; // The ID of the user making the request


    try {
        if (!firestore) {
            throw new Error("Firestore not initialized.");
        }

        const searchParams = req.nextUrl.searchParams;

        // --- Query Parameters ---
        const targetUserId = searchParams.get('userId'); // Filter by specific user's posts
        const limit = parseInt(searchParams.get('limit') || '20', 10); // Default limit 20
        const lastDocId = searchParams.get('lastDocId'); // For pagination
        const category = searchParams.get('category'); // Filter by category
        const sortBy = searchParams.get('sortBy') || 'createdAt'; // Default sort by creation date

        console.log(`Fetching posts (filter: ${targetUserId ? `by user ${targetUserId}` : 'all accessible'}, category: ${category || 'None'}), limit: ${limit}`);


        // 2. Build the Firestore Query
        let query: admin.firestore.Query = firestore.collection(COLLECTION_NAME);

        // --- Apply Filters ---
        if (category && COMMUNITY_POST_CATEGORIES.includes(category)) {
             // Assuming categories is an array field and we query for presence
             query = query.where('categories', 'array-contains', category);
             console.log(`Applying category filter: ${category}`);
        }
        if (targetUserId && typeof targetUserId === 'string') {
             // Filter by specific user's posts if userId parameter is present
             query = query.where('creatorId', '==', targetUserId);
             console.log(`Applying creatorId filter: ${targetUserId}`);
        } else {
             // If no userId parameter, fetch all community posts generally accessible to authenticated users.
             // Your Firestore Security Rules should handle what is readable.
             // No 'where' clause on creatorId here means it will fetch all posts (up to limit)
             // unless your rules limit reads in other ways.
             console.log(`No userId parameter provided. Fetching all community posts accessible to authenticated user ${currentUserId}.`);
        }


        // 3. Apply Sorting
        // Firestore requires an index for sorting by fields other than the primary one,
        // especially when filtering. createdAt should be descending for a feed.
        // Sorting by likesCount might require a composite index.
        const sortDirection = sortBy === 'createdAt' ? 'desc' : 'desc'; // Default to descending for feed
        // You might add logic here to handle different sort directions or fields
        // Example: if (sortBy === 'likesCount') query = query.orderBy('likesCount', 'desc').orderBy('createdAt', 'desc'); // Requires composite index
        query = query.orderBy(sortBy, sortDirection as admin.firestore.OrderByDirection);


        // 4. Apply Pagination (startAfter)
        if (lastDocId) {
             console.log(`Applying pagination: startAfter ${lastDocId}`);
            // To start after a specific document, we need to fetch that document first
            const lastDocSnapshot = await firestore.collection(COLLECTION_NAME).doc(lastDocId).get();
            if (lastDocSnapshot.exists) {
                query = query.startAfter(lastDocSnapshot);
            } else {
                 // If lastDocId doesn't exist, return an empty list or error
                 console.warn(`Pagination error: lastDocId ${lastDocId} not found.`);
                return NextResponse.json({ posts: [], message: "Pagination cursor not found." }, { status: 404 });
            }
        }

        // 5. Apply limit
        query = query.limit(limit);


        // 6. Execute the query
        const snapshot = await query.get();

        // 7. Map Firestore documents to a serializable format
        const posts: CommunityPost[] = snapshot.docs.map(doc => {
            const data = doc.data();
            // Explicitly map fields, converting Timestamps to ISO strings
            return {
                id: doc.id,
                creatorId: data.creatorId || '',
                creatorName: data.creatorName || 'Anonymous',
                creatorPhotoURL: data.creatorPhotoURL || null,
                textContent: data.textContent || '',
                linkUrl: data.linkUrl || null,
                mediaUrls: Array.isArray(data.mediaUrls) ? data.mediaUrls : null, // Return array or null
                hasMedia: data.hasMedia || false,
                isEvent: data.isEvent || false,
                eventDetails: data.eventDetails || null, // Return as is, handle dates client-side
                categories: Array.isArray(data.categories) ? data.categories : null, // Return array or null
                likeCount: data.likeCount || 0,
                commentCount: data.commentCount || 0,
                // Convert Firestore Timestamp to ISO strings
                createdAt: data.createdAt instanceof admin.firestore.Timestamp ? data.createdAt.toDate().toISOString() : new Date(0).toISOString(),
                updatedAt: data.updatedAt instanceof admin.firestore.Timestamp ? data.updatedAt.toDate().toISOString() : new Date(0).toISOString(),
            } as CommunityPost; // Cast for type safety (assuming CommunityPost matches this structure)
        });

        console.log(`API GET /api/community/posts: Successfully fetched ${posts.length} posts.`);

        // 8. Return the results as JSON
        // Assuming the frontend expects { posts: [...] }
        return NextResponse.json({ posts }, { status: 200 });

    } catch (error) {
        console.error('Error fetching community posts:', error);
        const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred.';
        // Check if it's a Firestore index error
        if (error instanceof Error && error.message.includes('index') || (error as any).code === 'failed-precondition') {
             console.warn('Firestore query requires an index. Check logs/console for index creation link.');
           return NextResponse.json({ message: 'Database index required.', error: errorMessage }, { status: 500});
        }
        // Handle specific Firestore permission error if rules deny read access
         if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'permission-denied') {
              console.warn(`GET /api/community/posts: Permission denied fetching posts (filter: ${targetUserId || 'All'}). Check Firestore Rules.`);
             return NextResponse.json({ message: 'Permission denied to read posts.' }, { status: 403 });
         }

        return NextResponse.json({ message: 'Failed to fetch community posts', error: errorMessage }, { status: 500 });
    }
}


// --- POST /api/community/posts ---
// Create a new community post
export async function POST(req: NextRequest) {
    console.log('--- POST /api/community/posts ---');

  // 1. Authenticate user
  const authResult = await authenticateUser(req);
  if (authResult.error || !authResult.user) {
      console.warn("POST /api/community/posts: Unauthorized attempt - ", authResult.error);
    return NextResponse.json({ message: authResult.error || 'Authentication failed' }, { status: authResult.status });
  }
    const user = authResult.user;


  try {
    const data = await req.json();

    // 2. Basic Data Validation
    const {
      textContent,
      mediaUrls, // Array of Data URLs temporarily
      linkUrl,
      isEvent,
      eventDetails,
      categories,
    } = data;

    if (!textContent || typeof textContent !== 'string' || textContent.trim() === '') {
      return NextResponse.json({ message: 'Text content is required' }, { status: 400 });
    }
    // Add more validation as needed (e.g., isEvent is boolean, eventDetails shape if isEvent is true, categories format)
    if (isEvent && (!eventDetails || typeof eventDetails !== 'object' || !eventDetails.date)) {
         return NextResponse.json({ message: 'Event details (including date) are required for events' }, { status: 400 });
    }
     if (mediaUrls && !Array.isArray(mediaUrls)) {
        return NextResponse.json({ message: 'mediaUrls must be an array' }, { status: 400 });
     }
     if (categories && !Array.isArray(categories)) {
        return NextResponse.json({ message: 'categories must be an array' }, { status: 400 });
     }


    // 3. Prepare the new post document
    const newPost: Partial<CommunityPost> = {
      creatorId: user.uid, // Set creator ID from authenticated user
      creatorName: user.name, // Set creator name from authenticated user
      creatorPhotoURL: user.photoURL, // Set creator photo from authenticated user
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use server timestamp
      textContent: textContent.trim(),
      likeCount: 0, // Initialize counts to 0
      commentCount: 0,
      isEvent: Boolean(isEvent), // Ensure boolean type
      mediaUrls: mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0 ? mediaUrls : null, // Save Data URLs (TEMPORARY)
      hasMedia: mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0, // Flag
      linkUrl: linkUrl || null,
      eventDetails: isEvent ? {
        // Convert event date string/timestamp from client to server Timestamp
        date: eventDetails.date ? admin.firestore.Timestamp.fromMillis(new Date(eventDetails.date).getTime()) : null,
        time: eventDetails.time || null,
        location: eventDetails.location || null,
        rsvpLink: eventDetails.rsvpLink || null,
      } : null,
      categories: categories && Array.isArray(categories) && categories.length > 0 ? categories : null,
    };

    // --- TEMPORARY: NOTE ON DATA URLS ---
    // Storing Data URLs in Firestore is NOT scalable or recommended for production.
    // This is a temporary workaround for pitching before integrating Firebase Storage.
     if (newPost.mediaUrls && newPost.mediaUrls.some(url => url && url.length > 100 * 1024)) { // Warn for large Data URLs (>100KB)
         console.warn('Warning: Storing large Data URLs in Firestore. This is temporary and not scalable.');
         // You might want to enforce a smaller limit or reject very large Data URLs
     }


    // 4. Add Document to Firestore
    const docRef = await firestore.collection(COLLECTION_NAME).add(newPost);

    console.log(`API POST /api/community/posts: Post created ID: ${docRef.id} by user ${user.uid}`);

    // 5. Return Success Response
    return NextResponse.json({ message: 'Post created successfully', postId: docRef.id }, { status: 201 });

  } catch (error) {
    console.error('Error creating community post:', error);
    const errorMessage = error instanceof Error ? error.message : 'An internal server error occurred while creating post.';
    if (error instanceof Error && error.stack) {
        console.error("Stack Trace:", error.stack);
    }
    return NextResponse.json({ message: 'Failed to create community post', error: errorMessage }, { status: 500 });
  }
}

// Add other HTTP methods (PUT, DELETE, etc.) here if needed at this level,
// although PATCH/DELETE for specific posts will be in [postId]/route.ts
// export async function PUT(req: NextRequest) { ... }
// export async function DELETE(req: NextRequest) { ... }