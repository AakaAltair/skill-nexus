// lib/types/resource.ts

// Import Timestamp type from Firestore client or admin SDK, depending on where you use it most.
// Using 'firebase/firestore' is common if types are shared with the frontend.
// Using 'firebase-admin/firestore' is fine if only used server-side or if admin SDK is primary.
import { Timestamp } from 'firebase/firestore';
// Or: import { Timestamp } from 'firebase-admin/firestore';

/**
 * Predefined types for categorizing resources.
 * Helps in filtering and UI representation.
 */
export type ResourceType =
  | 'Notes'
  | 'Question Bank'
  | 'Research Paper'
  | 'Video'
  | 'Link Collection'
  | 'Book PDF'
  | 'Presentation'
  | 'Code Repository'
  | 'Other'; // Fallback category

/**
 * Represents an educational resource shared by a user, designed for a detail/classroom view.
 */
export interface Resource {
  /** Firestore document ID. Optional as it's assigned by Firestore. */
  id?: string;

  /** Required. The main title of the resource (e.g., "DS Algo Midterm Q Bank"). */
  title: string;

  /** Optional. A brief description providing context about the resource. */
  description?: string;

  /** Required. The direct external URL pointing to the resource content (Drive, GitHub, website, etc.). */
  linkURL: string;

  /** Required. The category/type of the resource. */
  resourceType: ResourceType;

  /** Optional, but recommended for filtering. Academic branch (e.g., "Computer Science"). */
  branch?: string;

  /** Optional, but recommended for filtering. Target academic year (e.g., "2nd Year"). */
  year?: string;

  /** Optional. Associated college/university or source context. */
  college?: string;

  /** Optional, but recommended for filtering. Specific subject (e.g., "Data Structures"). */
  subject?: string;

  /** Required. Firebase Authentication UID of the user who uploaded/shared the resource. */
  uploaderId: string;

  /** Required. Display name of the uploader, stored for easy display. */
  uploaderName: string;

  /** Required. URL of the uploader's profile picture, stored for easy display. */
  uploaderPhotoURL: string;

  /** Required. Timestamp of when the resource was added. Can be Firestore Timestamp or ISO string. */
  createdAt: Timestamp | string;

  /** Optional. Timestamp of the last update to the resource metadata. Can be Firestore Timestamp or ISO string. */
  updatedAt?: Timestamp | string;

  /** Optional. Array of keywords for finer-grained searching. */
  tags?: string[];

  /** Optional. Controls whether the chat/comment sidebar is enabled for this resource. Defaults to true if undefined. */
  commentsEnabled?: boolean;

  // --- Potential Future Fields ---
  /** Number of updates posted (if tracked). */
  // updateCount?: number;
  /** Number of comments associated with the resource (if tracked). */
  // commentCount?: number;
}

/**
 * Represents an update or announcement posted within a resource's detail page.
 */
export interface ResourceUpdate {
    /** Firestore document ID. Optional as it's assigned by Firestore. */
    id?: string;

    /** Required. Firebase UID of the user who posted the update. */
    authorId: string;

    /** Required. Display name of the author, stored for easy display. */
    authorName: string;

    /** Required. URL of the author's profile picture, stored for easy display. */
    authorPhotoURL: string;

    /** Required. The text content of the update/announcement. */
    content: string;

    /** Optional. Array of attachments (define structure later if needed). */
    // attachments?: Attachment[]; // You would need to define Attachment type

    /** Required. Timestamp of when the update was posted. Can be Firestore Timestamp or ISO string. */
    createdAt: Timestamp | string;
}

/**
 * Represents a comment or reply within a resource's chat sidebar.
 */
export interface ResourceComment {
    /** Firestore document ID. Optional as it's assigned by Firestore. */
    id?: string;

    /** Required. Firebase UID of the user who posted the comment. */
    authorId: string;

    /** Required. Display name of the commenter, stored for easy display. */
    authorName: string;

    /** Required. URL of the commenter's profile picture, stored for easy display. */
    authorPhotoURL: string;

    /** Required. The text content of the comment. */
    text: string;

    /** Optional. The ID of the parent comment this is replying to. Null or undefined for top-level comments. */
    parentId?: string | null;

    /** Required. Timestamp of when the comment was posted. Can be Firestore Timestamp or ISO string. */
    createdAt: Timestamp | string;

    // --- Potential Future Fields ---
    /** Timestamp of the last edit to the comment. */
    // updatedAt?: Timestamp | string;
    /** Data structure for reactions. Key is emoji, value is array of UIDs who reacted. */
    // reactions?: { [emoji: string]: string[] };
    /** Count of direct replies to this comment. */
    // replyCount?: number;
}

// Example (Optional) Attachment structure if needed for ResourceUpdate later
/*
export interface Attachment {
    name: string; // e.g., 'diagram.png'
    url: string; // URL to the file in Storage or elsewhere
    type: 'image' | 'pdf' | 'link' | 'file'; // Type indicator
    size?: number; // Optional file size in bytes
}
*/