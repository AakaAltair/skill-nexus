// lib/types/placement.ts

import { Timestamp } from 'firebase/firestore'; // Or 'firebase-admin/firestore'

// --- Enum/Union Types ---

/** Status options for a placement drive. */
export type PlacementStatus = 'Upcoming' | 'Ongoing' | 'Past' | 'Cancelled';

/** Type options for a student's placement achievement. */
export type PlacementType = 'Internship' | 'Full-time' | 'PPO' | 'Other';

// --- Main Interfaces ---

/**
 * Represents a specific placement drive or opportunity posted on the hub.
 * (No changes needed here based on the last request)
 */
export interface PlacementDrive {
  id?: string;
  companyName: string;
  companyLogoURL?: string;
  roleTitle: string;
  description: string;
  eligibilityCriteria?: string;
  status: PlacementStatus;
  keyDates?: {
    applicationDeadline?: Timestamp | string;
    testDate?: Timestamp | string;
    interviewDate?: Timestamp | string;
    startDate?: Timestamp | string;
  };
  packageDetails?: string;
  applicationLink?: string;
  applicationInstructions?: string;
  location?: string;
  eligibleBranches?: string[];
  contactPerson?: string;
  commentsEnabled?: boolean;
  postedById: string; // UID of admin/poster
  postedByName: string;
  postedByPhotoURL: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

/**
 * Represents a student's success story/achievement post.
 * Separates creator info from the placed student's info.
 */
export interface StudentAchievement {
  /** Firestore document ID. Optional. */
  id?: string;

  // --- Creator Information ---
  /** Required. Firebase UID of the user who CREATED this post. */
  creatorId: string;

  /** Required. Display name of the creator. */
  creatorName: string;

  /** Required. URL of the creator's profile picture. */
  creatorPhotoURL: string;

  // --- Placed Student Information ---
  /** Required. Full name of the STUDENT WHO GOT PLACED. */
  placedStudentName: string;

  /** Optional. Placed student's branch/department. */
  placedStudentBranch?: string;

  /** Optional. Placed student's academic year/batch. */
  placedStudentYear?: string;

  /** Optional. Photo URL specifically for the placed student (if different from creator and available). */
  placedStudentPhotoURL?: string; // Might use creatorPhotoURL as fallback if not provided

  // --- Placement Details ---
  /** Required. Name of the company the student got placed in. */
  companyName: string;

  /** Optional. URL to the company's logo. */
  companyLogoURL?: string;

  /** Optional but recommended. Title of the role secured. */
  roleTitle?: string;

  /** Optional. Type of placement (Internship, Full-time, etc.). */
  placementType?: PlacementType;

  /** Optional. Job location(s). */
  location?: string;

  /** Optional. Salary or package details (stored as string for flexibility). */
  salary?: string;

  // --- Content Fields ---
  /** Optional. A more detailed description of the role/job provided by the poster. */
  jobDescription?: string;

   /** Optional. Array of relevant skills used or gained. */
   skills?: string[];

  /** Required. The main text content (Experience/Advice posted by the creator). */
  text: string;

  /** Optional. A separate personal message or quote (can be from the placed student or the creator). */
  personalMessage?: string;


  // --- Timestamps ---
  /** Required. Timestamp of when the achievement was posted. */
  createdAt: Timestamp | string;

  /** Optional. Timestamp of the last update to the achievement post. */
  updatedAt?: Timestamp | string;

  // --- Removed separate name fields ---
  // The 'placedStudentName' will store the full name collected from the form.
  // If you need structured names later, add specific fields like:
  // placedStudentFirstName?: string;
  // placedStudentSurname?: string;
}

/**
 * Represents a comment or question posted on a specific Placement Drive detail page.
 * (No changes needed here)
 */
export interface PlacementComment {
  id?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  text: string;
  parentId?: string | null;
  createdAt: Timestamp | string;
}

/**
 * Represents an update or announcement posted within a Placement Drive's detail page.
 * (No changes needed here)
 */
export interface PlacementUpdate {
    id?: string;
    authorId: string;
    authorName: string;
    authorPhotoURL: string;
    content: string;
    attachments?: Attachment[]; // Assuming Attachment type is defined elsewhere or reused
    createdAt: Timestamp | string;
}

/**
 * Example Attachment structure (if used for PlacementUpdate)
 * Define this or import from a shared types file if needed.
 */
 export interface Attachment {
    name: string;
    url: string; // URL to the file in Storage or elsewhere
    type: 'image' | 'pdf' | 'link' | 'file'; // Type indicator
    size?: number; // Optional file size in bytes
}