// lib/types/community.ts

import { Timestamp } from 'firebase-admin/firestore'; // Assuming you use firebase-admin types for server-side
// Or use firebase/firestore for client-side:
// import { Timestamp } from 'firebase/firestore';
// Make sure you are consistent or map between them if needed.
// For shared types, using firebase-admin types might be safer if they are primarily used in API routes,
// otherwise using firebase/firestore types is more common for client.
// Let's use firebase/firestore types as they are also used in the frontend.
// If using firebase-admin in API routes, you might need casting or utility types.
import { Timestamp as ClientTimestamp } from 'firebase/firestore';

// Helper type for date fields
type ServerTimestamp = ClientTimestamp; // Alias for clarity

// --- CommunityPost Interface ---
export interface CommunityPost {
  id: string; // Firestore Document ID
  creatorId: string; // Firebase Auth UID of the poster
  creatorName: string; // Display name of the poster
  creatorPhotoURL: string | null; // Avatar URL of the poster
  createdAt: ServerTimestamp; // Firestore server timestamp
  updatedAt?: ServerTimestamp; // Optional for edits
  text: string; // The main content (can contain Markdown)
  mediaUrls?: string[] | null; // Array of URLs for images/videos (Temporary: will store Data URLs for pitching)
  linkUrl?: string | null; // Optional: A primary link associated with the post
  // Future: linkPreview? : { title: string, description: string, imageUrl: string } | null;
  isEvent: boolean; // Flag to indicate if this post is an event
  eventDetails?: { // Details if isEvent is true
    date: ServerTimestamp; // Event date (just date part ideally, time can be separate)
    time?: string | null; // Event time (e.g., "10:00 AM", "TBD")
    location?: string | null; // Event location (e.g., "College Auditorium", "Online")
    rsvpLink?: string | null; // Optional RSVP or ticket link
  } | null;
  categories?: string[] | null; // e.g., ["Club Event", "Academic Update", "Opportunity"]
  likesCount: number; // Denormalized counter for likes
  commentsCount: number; // Denormalized counter for comments
}

// --- CommunityComment Interface ---
export interface CommunityComment {
  id: string; // Firestore Document ID
  postId: string; // Parent post ID
  creatorId: string; // Firebase Auth UID of the commenter
  creatorName: string; // Display name of the commenter
  creatorPhotoURL: string | null; // Avatar URL of the commenter
  createdAt: ServerTimestamp;
  updatedAt?: ServerTimestamp; // Optional for edits
  text: string; // Comment content
  parentId?: string | null; // Optional: ID of the parent comment for threading
}

// --- CommunityLike Interface ---
export interface CommunityLike {
  id: string; // Should be the creatorId (UID of the user who liked)
  creatorId: string; // UID of the user who liked
  createdAt: ServerTimestamp;
}

// --- Category Options (Example) ---
// You might fetch this from a config or database later, but for now, define some examples
export const COMMUNITY_POST_CATEGORIES = [
  'General Update',
  'Club Event',
  'Academic News',
  'Opportunity', // Internships, Jobs, etc.
  'Achievement',
  'Discussion',
];

// Note: For pitching with Data URLs, the mediaUrls field will store base64 encoded strings.
// In a real implementation with Firebase Storage, it would store gs:// or https:// download URLs.