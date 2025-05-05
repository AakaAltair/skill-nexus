// lib/types/project.ts
import { Timestamp } from 'firebase/firestore';

// --- ProjectMember Interface ---
export interface ProjectMember {
    userId: string;
    name: string;
    photoURL: string;
    role?: string;
}

// --- ProjectType and ProjectStatus Enums/Types ---
export type ProjectType = "Personal" | "College Course" | "Department Initiative" | "Competition" | "Research" | "Open Source Contribution" | "Startup Idea" | "Tutorial/Example" | "Other";
export type ProjectStatus = "Idea" | "Planning" | "In Progress" | "Paused" | "Completed" | "Archived";

// --- Project Interface ---
export interface Project {
    id?: string;
    title: string;
    description: string;
    creatorId: string;
    creatorName: string;
    creatorPhotoURL: string;
    createdAt: Timestamp | string;
    updatedAt: Timestamp | string;
    projectType: ProjectType;
    status: ProjectStatus;
    skills: string[];
    techStack?: string;
    members: ProjectMember[];
    lookingForMembers?: boolean;
    rolesNeeded?: string[];
    coverImageURL?: string;
    projectLink?: string;
    repoLink?: string;
    lastUpdateSummary?: string;
    location?: string;
    commentsEnabled?: boolean; // Keep this setting
}

// --- Attachment Interface ---
export interface Attachment {
    name: string;
    url: string;
    type: 'link' | 'file' | 'image';
}

// --- ProjectUpdate Interface ---
export interface ProjectUpdate {
    id?: string;
    authorId: string;
    authorName: string;
    authorPhotoURL: string;
    content: string;
    attachments?: Attachment[];
    createdAt: Timestamp | string;
}

// --- Comment Interface (UPDATED) ---
export interface Comment {
    id?: string; // Firestore document ID
    // projectId is implicit via subcollection path
    updateId: string; // <-- ADDED: ID of the ProjectUpdate this comment belongs to
    parentId: string | null; // ID of the parent comment for replies (null for top-level on an update)
    authorId: string;
    authorName: string;
    authorPhotoURL: string;
    text: string;
    createdAt: Timestamp | string;
}