// lib/types/learning.ts

import { Timestamp } from 'firebase/firestore';

// --- Core Learning Classroom Type ---
export interface LearningClassroom {
  id: string;
  name: string; // e.g., "2023-24-2nd Year-Sem 4-CSE-A-Batch 1"
  academicYear: string; // e.g., "2023-24"
  year: string; // e.g., "2nd Year"
  semester: string; // e.g., "Sem 4"
  branch: string; // e.g., "CSE"
  class?: string; // e.g., "A"
  division?: string; // e.g., "A" (can be same as class)
  batch?: string; // e.g., "Batch 1"
  description?: string;
  teacherIds: string[]; // UIDs of teachers managing this classroom
  studentIds: string[]; // UIDs of students in this classroom
  memberIds: string[]; // Array containing all teacherIds and studentIds (for easier querying)
  joinCode: string; // Unique code for students to join
  commentsEnabled: boolean; // Whether Q&A/comments are allowed in the chat sidebar
  createdAt: Timestamp | Date; // Firestore Timestamp on backend, Date or string on frontend
  updatedAt?: Timestamp | Date;
  coverImageURL?: string; // For banner (optional)
}

// --- Stream Item Type (Announcements, materials etc.) ---
// Reusing Attachment type structure from Project/Resource if identical
export interface Attachment {
    name: string;
    url: string; // Can be external URL, Firebase Storage URL, or temporary 'local:...'
    type: 'link' | 'file' | 'image' | 'video' | 'pdf'; // Extend as needed
    // Temporary metadata for files not yet uploaded to Storage
    fileMetadata?: {
        size: number; // in bytes
        fileType: string; // MIME type
    };
}

export interface ClassroomStreamItem {
    id: string;
    classroomId: string;
    type: 'announcement' | 'material' | 'important-date' | 'format-template' | 'other';
    content: string; // Markdown supported
    attachments?: Attachment[]; // Links or temporary file metadata
    postedById: string; // UID of user who posted (likely teacher)
    postedByName: string;
    postedByPhotoURL?: string;
    createdAt: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}

// --- Comment Type for Stream/Chat ---
export interface ClassroomComment {
    id: string;
    classroomId: string;
    streamItemId?: string; // Optional: If this comment is directly under a stream item
    parentId?: string; // Optional: For replies to other comments
    text: string;
    postedById: string; // UID of user who posted (teacher or student)
    postedByName: string;
    postedByPhotoURL?: string;
    createdAt: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}


// --- Student Learning Entry Type (PBL, SBL, TBL submission) ---
export interface StudentLearningEntry {
    id: string;
    classroomId: string;
    studentId: string; // UID of the student submitting
    title: string; // Student-defined title (e.g., "Week 3 PBL Progress")
    entryDate: Timestamp | Date; // Date the entry represents
    weekNumber?: number; // Optional: If following strict weekly cadence
    learningType: 'PBL' | 'SBL' | 'TBL';
    tasksPerformed: string;
    planning: string;
    nextSteps: string;
    challenges: string;
    learning: string;
    durationHours?: number; // Optional estimate
    links?: string[]; // Relevant external links

    // --- Temporary File Metadata (before Firebase Storage upload) ---
    reportFileMetadata?: { filename: string, size: number, fileType: string };
    presentationFileMetadata?: { filename: string, size: number, fileType: string };
    certificateFileMetadata?: { filename: string, size: number, fileType: string };

    // --- Placeholder for Future Firebase Storage URLs ---
    reportFileUrl?: string;
    presentationFileUrl?: string;
    certificateFileUrl?: string;

    // --- Data for Custom Fields ---
    customFieldsData?: { [fieldName: string]: any }; // Key-value map for custom field inputs

    isSubmitted?: boolean; // Optional: To mark an entry as finalized
    submissionDate?: Timestamp | Date; // Optional: When finalized

    createdAt: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}

// --- Teacher-Defined Custom Field Type ---
export interface CustomLearningField {
    id: string; // Firestore document ID for the field
    classroomId: string;
    fieldName: string; // Label (e.g., "Plagiarism Certificate URL")
    fieldType: 'text' | 'textarea' | 'number' | 'date' | 'url' | 'file' | 'checkbox' | 'select'; // Input type hint, 'file' matches file metadata fields
    isRequired: boolean;
    order: number; // For ordering fields in the student form
    options?: string[]; // For 'select' type
    createdAt: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}


// --- Teacher Feedback on a Learning Entry ---
export interface LearningEntryFeedback {
    id: string; // Firestore document ID for the feedback
    entryId: string; // The learning entry this feedback belongs to
    classroomId: string; // Redundant but useful for some queries/rules
    teacherId: string; // UID of the teacher providing feedback
    teacherName: string;
    feedbackText: string;
    grade?: string | number; // Optional grade
    createdAt: Timestamp | Date;
    updatedAt?: Timestamp | Date;
}

// --- Auth User with Role Info (Example, depends on your auth context setup) ---
// You likely already have a similar user type that includes role.
export interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role?: 'student' | 'teacher' | 'admin'; // Role field, assume this is fetched after login
    // Add other user-specific fields if stored (e.g., branch, year, etc.)
}