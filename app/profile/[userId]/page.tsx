// app/profile/[userId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import firebaseApp from '@/app/firebase';
// --- Import Link component ---
import Link from 'next/link'; // <--- Added this import
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Project } from '@/lib/types/project'; // Existing type
// Assuming you have a type for Community Posts
// TODO: Import CommunityPost type from lib/types/community.ts
// import { CommunityPost } from '@/lib/types/community'; // Define or import this type
import { formatSimpleDate, formatFullTimestamp } from '@/lib/dateUtils'; // Ensure this utility exists and handles ISO strings/Dates
import { Timestamp } from 'firebase/firestore'; // Import Firestore Timestamp for type checking

// --- Import Components (reused display logic) ---
import CompactProjectCard from '@/components/CompactProjectCard';
// If you have a reusable Community Post Card component, import it here:
// import CommunityPostCard from '@/components/CommunityPostCard';


// --- Import Icons ---
import { Loader2, Link as LinkIcon, Linkedin, Github, Globe, Mail, Phone, ChevronRight } from 'lucide-react';


// TODO: Import StudentProfile type from lib/types/profile.ts
interface StudentProfile {
    userId: string;
    name: string;
    photoURL?: string | null;
    headline?: string | null;
    summary?: string | null;
    contactInfo?: {
        email?: string | null;
        phone?: string | null;
        location?: string | null;
        portfolioUrl?: string | null;
        linkedInUrl?: string | null;
        githubUrl?: string | null;
    } | null;
    education?: Array<{ id: string; institution: string; degree: string; fieldOfStudy: string; startDate?: any; endDate?: any; description?: string | null }>;
    experience?: Array<{ id: string; company: string; title: string; location?: string | null; startDate?: any; endDate?: any; description: string }>;
    certifications?: Array<{ id: string; name: string; issuer: string; issueDate?: any; expirationDate?: any; credentialUrl?: string | null }>;
    manualProjects?: Array<{ id: string; title: string; description: string; projectUrl?: string | null; skills?: string[]; startDate?: any; endDate?: any }>;
    skills?: Array<{ id: string; name: string; category: string }>;
    languages?: Array<{ id: string; language: string; proficiency: string }>;
    awards?: Array<{ id: string; title: string; issuer?: string | null; date?: any; description?: string | null }>;
    extracurriculars?: Array<{ id: string; organization: string; position: string; description?: string | null; startDate?: any; endDate?: any }>;
    updatedAt?: any;
}

// Define a minimal type for Community Posts as returned by the API
// TODO: Move this type definition to lib/types/community.ts and import it
interface CommunityPostSummary {
    id: string;
    creatorId: string;
    creatorName: string; // Redundant here, but usually included in post data
    creatorPhotoURL?: string | null; // Redundant here
    textContent: string; // Use textContent as per your POST handler
    linkUrl?: string | null; // Use linkUrl as per your POST handler
    mediaUrls?: string[] | null; // Use mediaUrls as per your POST handler (array of URLs/Data URLs)
    hasMedia?: boolean;
    isEvent?: boolean;
    eventDetails?: { // Assuming simple structure
      date?: any; // Timestamp or ISO string
      time?: string | null;
      location?: string | null;
      rsvpLink?: string | null;
    } | null;
    categories?: string[] | null;
    createdAt: string; // ISO string expected from backend
    likeCount?: number;
    commentCount?: number;
    // Add other summary fields you need from the post
}


// Define sections relevant for display on the public profile
const profileSectionsToDisplay = [
    // Summary is often part of the header/intro section
    { id: 'experience', title: 'Experience' },
    { id: 'education', title: 'Education' },
    { id: 'certifications', title: 'Licenses & Certs' },
    // Projects section handled separately
    { id: 'skills', title: 'Skills' },
    { id: 'languages', title: 'Languages' },
    { id: 'awards', title: 'Honors & Awards' },
    { id: 'extracurriculars', title: 'Activities' },
     // Add a section definition for Posts - Will render separately
    { id: 'posts', title: 'Community Posts' },
];


// TODO: Move to a shared utility file (e.g., lib/utils/avatarUtils.ts)
const getInitials = (name?: string | null, email?: string | null): string => {
    if (name) {
        const parts = name.trim().split(/\s+/).filter(Boolean); // Split by spaces and remove empty strings
        if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts.length === 1 && parts[0]) {
             // Take first two letters if single name, or just first if less than 2
            return parts[0].substring(0, Math.min(parts[0].length, 2)).toUpperCase();
        }
    }
    if (email) {
         // Take first letter of email if no name or name is empty/only whitespace
        return email[0]?.toUpperCase() || '?'; // Use optional chaining and default if email is empty string
    }
    return 'P'; // Default placeholder (e.g., "Profile") if no name or email
};

// TODO: Move to a shared utility file
const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || url.trim() === '') return false; // A URL must be present and not just whitespace for display
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch (_) {
        return false;
    }
};

// TODO: Move to a shared utility file (e.g., lib/dateUtils.ts or lib/validationUtils.ts)
function isValidDate(date: any): date is Date | Timestamp | string { // Added string as dateValue might be ISO string from API
    if (!date) return false;
    try {
        if (date instanceof Timestamp) {
            return typeof date.seconds === 'number' && !isNaN(date.seconds);
        }
        if (date instanceof Date) {
            return !isNaN(date.getTime());
        }
         if (typeof date === 'string') {
             if (!date || date === 'Invalid Date') return false;
             // Attempt parsing the string to check if it's a valid date representation
             return !isNaN(new Date(date).getTime());
         }
    } catch {
        return false;
    }
    return false;
}


export default function UserProfilePage() {
    const params = useParams();
    const targetUserId = params.userId as string; // Get the userId from the URL

    const router = useRouter();
    const auth = getAuth(firebaseApp);

    // --- State ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    // Initialize authLoading based on whether a user session is already known (faster initial render)
    const [authLoading, setAuthLoading] = useState(auth.currentUser === null);

    const [profileData, setProfileData] = useState<StudentProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);

    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);

    // --- State for Community Posts ---
    const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [postsError, setPostsError] = useState<string | null>(null);

     // State to track if the profile image failed to load on THIS page
     const [profilePhotoLoadError, setProfilePhotoLoadError] = useState(false);


    // --- Reset profilePhotoLoadError when profileData.photoURL changes ---
    useEffect(() => {
        setProfilePhotoLoadError(false);
    }, [profileData?.photoURL]);


    // --- Authentication Check & Redirect ---
    useEffect(() => {
        // Check if auth is already resolved on mount (faster initial render)
        if (auth.currentUser !== null && !authLoading) {
             // Already authenticated, proceed with check
             console.log("UserProfilePage: Auth already resolved on mount.");
             const user = auth.currentUser;
             setCurrentUser(user);
             // If the user's ID matches the target ID, redirect them to dashboard
              if (targetUserId && user.uid === targetUserId) {
                  console.log("Viewing own profile via public route, redirecting to dashboard...");
                  router.replace('/dashboard'); // Use replace to prevent navigating back
                  // Do NOT set authLoading to false here, as we are redirecting
                  return;
              }
               console.log(`Auth check successful (resolved on mount). User ${user?.uid} viewing profile ${targetUserId}.`);
               // No need to set authLoading false, it was already false or handled by initial state

        } else {
            // Listen for auth state changes if not already resolved
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                setCurrentUser(user);
                setAuthLoading(false); // Auth state is now known

                if (user) {
                    // If authenticated now, check if it's their own profile
                     if (targetUserId && user.uid === targetUserId) {
                         console.log("Viewing own profile via public route (auth listener), redirecting to dashboard...");
                         router.replace('/dashboard'); // Use replace
                         return; // Stop further execution in this effect cycle
                     }
                     console.log(`Auth check successful (listener). User ${user?.uid} viewing profile ${targetUserId}.`);

                } else {
                    // Not authenticated
                    console.log("User not authenticated (listener), redirecting to login.");
                    router.push('/login'); // Redirect if not authenticated
                     // setAuthLoading(false) is done above
                }
            });
            return () => unsubscribe(); // Cleanup subscription
        }
    }, [auth, router, targetUserId, authLoading]); // Depend on auth, router, targetUserId, and authLoading


    // --- Data Fetching (Profile) ---
    const fetchProfile = useCallback(async () => {
        // Only fetch if currentUser is valid AND targetUserId exists AND it's NOT the current user's ID
        if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
             console.log("fetchProfile skipped: Missing auth user, targetUserId, or viewing own profile.");
             setProfileLoading(false); // Ensure loading is off if skipped
             return;
        }
        console.log(`fetchProfile started for target user: ${targetUserId} (requested by ${currentUser.uid})`);
        setProfileLoading(true);
        setProfileError(null);
        try {
            const token = await getIdToken(currentUser);
            const response = await fetch(`/api/profile?userId=${encodeURIComponent(targetUserId)}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                 if (response.status === 404) throw new Error(`Profile not found for user ID: ${targetUserId}`);
                throw new Error(`Failed to fetch profile: ${response.status} ${errorData.message || ''}`);
            }
            const responseData = await response.json();
            if (!responseData.profile) throw new Error("Profile data not found in API response.");
            const data: StudentProfile = responseData.profile;
            console.log("Profile data fetched successfully:", data);
            setProfileData(data);
        } catch (err: any) {
            console.error("Error fetching profile:", err);
            setProfileError(err.message || 'An unknown error occurred while fetching profile.');
            setProfileData(null);
        } finally {
            setProfileLoading(false);
        }
    }, [currentUser, targetUserId]);


     // --- Data Fetching (Projects) ---
     const fetchProjects = useCallback(async () => {
         // Only fetch if currentUser is valid AND targetUserId exists AND it's NOT the current user's ID
         if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
              console.log("fetchProjects skipped: Missing auth user, targetUserId, or viewing own profile.");
             setProjectsLoading(false); // Ensure loading is off if skipped
             return;
         }
         console.log(`fetchProjects started for target user: ${targetUserId} (requested by ${currentUser.uid})`);
         setProjectsLoading(true);
         setProjectsError(null);
         try {
             const token = await getIdToken(currentUser);
             const response = await fetch(`/api/projects?userId=${encodeURIComponent(targetUserId)}`, {
                 headers: { 'Authorization': `Bearer ${token}` },
             });
             if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ message: response.statusText }));
                 throw new Error(`Failed to fetch projects: ${response.status} ${errorData.message || ''}`);
             }
             const responseData = await response.json();
             if (responseData && Array.isArray(responseData.projects)) {
                 const data: Project[] = responseData.projects;
                 console.log("Projects data fetched successfully:", data);
                 setProjects(data);
             } else {
                 console.error("Unexpected API response format for projects:", responseData);
                 setProjects([]);
                 setProjectsError("Received unexpected data format for projects.");
             }

         } catch (err: any) {
             console.error("Error fetching projects:", err);
             setProjectsError(err.message || 'An unknown error occurred while fetching projects.');
              setProjects([]);
         } finally {
             setProjectsLoading(false);
         }
     }, [currentUser, targetUserId]);


     // --- Data Fetching (Community Posts) ---
     const fetchPosts = useCallback(async () => {
        // Only fetch posts if the user viewing is authenticated and we have a targetUserId
         if (!currentUser || !targetUserId) {
             console.log("fetchPosts skipped: Missing auth user or targetUserId.");
             setPostsLoading(false); // Ensure loading is off if skipped
             return;
         }
         console.log(`fetchPosts started for target user: ${targetUserId} (requested by ${currentUser.uid})`);
         setPostsLoading(true);
         setPostsError(null);
         try {
             const token = await getIdToken(currentUser);
             // Fetch posts using the community posts API, filtered by targetUserId
             // Added limit=10 to fetch recent posts for the profile view
             const response = await fetch(`/api/community/posts?userId=${encodeURIComponent(targetUserId)}&limit=10`, {
                 headers: { 'Authorization': `Bearer ${token}` },
             });

             if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ message: response.statusText }));
                 throw new Error(`Failed to fetch posts: ${response.status} ${errorData.message || ''}`);
             }
             const responseData = await response.json();
              // Assuming API returns { posts: CommunityPostSummary[] }
             if (responseData && Array.isArray(responseData.posts)) {
                 const data: CommunityPostSummary[] = responseData.posts;
                 console.log("Posts data fetched successfully:", data);
                 setPosts(data);
             } else {
                 console.error("Unexpected API response format for posts:", responseData);
                 setPosts([]); // Ensure it's an empty array on unexpected data
                 setPostsError("Received unexpected data format for posts.");
             }

         } catch (err: any) {
             console.error("Error fetching posts:", err);
             setPostsError(err.message || 'An unknown error occurred while fetching posts.');
              setPosts([]); // Ensure it's an empty array on error
         } finally {
             setPostsLoading(false);
         }
     }, [currentUser, targetUserId]); // Depend on currentUser and targetUserId


    // --- Trigger all data fetches when auth is complete and targetUserId is available ---
    // This effect ensures data is fetched only when the user is authenticated, the target user ID is known,
    // AND it's confirmed that the target user is NOT the current user (redirect handled by auth effect).
    useEffect(() => {
        // Only trigger fetches if auth is NOT loading AND currentUser is valid AND targetUserId exists
        // The check `currentUser.uid !== targetUserId` is handled implicitly because the auth effect
        // would have redirected if it were the current user's profile.
        if (!authLoading && currentUser && targetUserId) {
             console.log("Auth state settled, user found (not target), targetUserId available. Triggering ALL data fetches.");
             fetchProfile();
             fetchProjects();
             fetchPosts(); // <<< --- Trigger fetching posts here ---
        } else if (!authLoading && (!currentUser || !targetUserId)) {
             // If auth settled but no user OR no targetUserId, handle redirection/error
             if (!currentUser) {
                 console.log("Auth settled, no user. Redirect handled by auth effect.");
                 // Redirection to /login already handled
             } else if (!targetUserId) {
                  console.log("Auth settled, user found, but target userId missing. Redirecting to users.");
                  setProfileError("User ID missing from URL.");
                  setTimeout(() => router.replace('/users'), 0); // Redirect to the directory page
             }
             // Ensure loading states are off if no fetches were triggered
             setProfileLoading(false);
             setProjectsLoading(false);
             setPostsLoading(false); // Also set posts loading off
        }
         // No cleanup needed for fetches as useCallback handles dependencies

    }, [currentUser, authLoading, targetUserId, fetchProfile, fetchProjects, fetchPosts, router]);


    // --- Render Loading/Error States ---
    // Show loading if auth is still pending OR if any data fetch is pending (and we are not redirecting)
    if (authLoading || profileLoading || projectsLoading || postsLoading) { // Include postsLoading
         // Determine if a redirect is imminent based on the current state
         const isRedirecting = !authLoading && (!currentUser || !targetUserId || (currentUser && targetUserId && currentUser.uid === targetUserId));
         if (isRedirecting) {
             // Show a minimal redirect message/spinner if redirect is happening
             return (
                 <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                     <Loader2 className="animate-spin text-gray-500" size={32} />
                     <span className="ml-2 text-gray-500">Loading Profile...</span> {/* Generic message */}
                 </div>
             );
         }
         // Otherwise, show data loading state
         return (
             <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                <Loader2 className="animate-spin text-gray-500" size={32} />
                <span className="ml-2 text-gray-500">Loading Profile Data...</span>
             </div>
         );
     }

    // Show error if profile failed to load (and we didn't redirect or shouldn't have)
     if (profileError || !profileData) {
         // Re-check if a redirect should have happened (defensive)
         const shouldRedirect = !authLoading && (!currentUser || !targetUserId || (currentUser && targetUserId && currentUser.uid === targetUserId));
          if (shouldRedirect) {
             return (
                 <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                     <Loader2 className="animate-spin text-gray-500" size={32} />
                     <span className="ml-2 text-gray-500">Preparing redirect...</span>
                 </div>
              );
          }

         return (
             <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                 <div className="text-center p-10 bg-white border border-red-200 rounded-lg shadow-md max-w-md">
                    <p className="text-red-600 font-semibold text-lg">Error Loading Profile</p>
                    <p className="text-red-500 text-sm mt-2 mb-4">{profileError || 'Could not load profile data.'}</p>
                     {/* Add a back button */}
                     <button
                         onClick={() => router.back()}
                         className='px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none transition-colors mt-4'
                     >
                         Go Back
                     </button>
                 </div>
             </div>
         );
     }


    // --- Determine whether to show image or fallback avatar ---
    const displayPhotoURL = profileData.photoURL?.trim(); // Use trimmed URL
    const showProfileImage = displayPhotoURL && isValidUrl(displayPhotoURL) && !profilePhotoLoadError;


    // --- Main Render Function (Read-Only Display) ---
    // If we reach this point: user is authenticated, profileData is loaded (and it's NOT their own), projects/posts loading complete (success or empty), no major errors with profile data.
    return (
        <div className="flex pt-16 bg-gray-50 min-h-screen"> {/* Navbar height offset */}

             {/* No sidebar on public profile view for simplicity */}

            {/* Main Content Area */}
            <main className="flex-grow p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto max-w-4xl mx-auto w-full"> {/* Center content */}

                {/* --- Profile Header Section (Read-Only) --- */}
                <section
                    className="mb-8 lg:mb-10 p-6 border border-gray-200 rounded-lg bg-white shadow-sm relative"
                >
                     {/* No Edit button here */}
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* --- Avatar Display Logic --- */}
                        {showProfileImage ? (
                            <img
                                src={displayPhotoURL}
                                alt={`${profileData.name}'s profile picture`}
                                width={100}
                                height={100}
                                className="rounded-full object-cover border-2 border-gray-300 flex-shrink-0 w-24 h-24 sm:w-[100px] sm:h-[100px]" // Use explicit Tailwind size
                                onError={() => {
                                    console.warn("Profile image failed to load from URL:", displayPhotoURL);
                                    setProfilePhotoLoadError(true);
                                }}
                            />
                        ) : (
                            <div className="w-24 h-24 sm:w-[100px] sm:h-[100px] rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-4xl font-medium border-2 border-gray-300 flex-shrink-0">
                                {getInitials(profileData.name, profileData.contactInfo?.email || profileData.userId)}
                            </div>
                        )}
                         {/* --- End Avatar Display Logic --- */}


                        <div className='text-center sm:text-left min-w-0 flex-grow'>
                            <h1 className="text-2xl md:text-3xl font-bold text-black truncate" title={profileData.name || 'Unnamed User'}>
                                {profileData.name || <i className="italic text-gray-500">Unnamed User</i>}
                            </h1>
                            {profileData.headline && (
                                <p className="text-md md:text-lg text-gray-700 mt-1 truncate" title={profileData.headline}>
                                    {profileData.headline}
                                </p>
                            )}
                            {/* Contact Info (Show public fields) */}
                             <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-3 text-gray-600">
                                {profileData.contactInfo?.email && (
                                    <a href={`mailto:${profileData.contactInfo.email}`} className="flex items-center gap-1 text-sm hover:text-blue-600 hover:underline transition-colors" aria-label="Email">
                                        <Mail size={14}/> {profileData.contactInfo.email}
                                    </a>
                                )}
                                 {profileData.contactInfo?.linkedInUrl && (
                                     <a href={profileData.contactInfo.linkedInUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:text-blue-600 hover:underline transition-colors" aria-label="LinkedIn Profile">
                                        <Linkedin size={14}/> LinkedIn
                                    </a>
                                )}
                                 {profileData.contactInfo?.githubUrl && (
                                     <a href={profileData.contactInfo.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:text-blue-600 hover:underline transition-colors" aria-label="GitHub Profile">
                                        <Github size={14}/> GitHub
                                    </a>
                                )}
                                {profileData.contactInfo?.portfolioUrl && (
                                     <a href={profileData.contactInfo.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:text-blue-600 hover:underline transition-colors" aria-label="Portfolio Website">
                                        <Globe size={14}/> Portfolio
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                 </section>

                 {/* --- Summary Section --- */}
                 {/* Render Summary if it exists */}
                 {profileData.summary && profileSectionsToDisplay.find(s => s.id === 'summary') && (
                      <section
                          id="profile-summary"
                          className="mb-8 p-5 border border-gray-200 rounded-lg bg-white shadow-sm relative"
                           aria-labelledby="profile-summary-heading"
                      >
                          <div className="flex justify-between items-center mb-4 min-h-[28px]">
                              <h2 id="profile-summary-heading" className="text-xl font-semibold text-black">Summary</h2>
                          </div>
                          <div className="text-base text-gray-800 whitespace-pre-wrap prose prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{profileData.summary}</ReactMarkdown>
                          </div>
                      </section>
                 )}


                {/* --- Render other profile sections with content (Read-Only) --- */}
                 {profileSectionsToDisplay
                    .filter(section => section.id !== 'summary' && section.id !== 'posts') // Filter out sections rendered separately
                    .map((sectionInfo) => {
                    let sectionData: any = null;
                     try {
                        sectionData = profileData[sectionInfo.id as keyof StudentProfile];
                    } catch (e) {
                         console.warn(`Error accessing section data for ${sectionInfo.id} on public profile:`, e);
                         return null;
                    }

                    let hasContent = false;
                    if (Array.isArray(sectionData)) {
                        hasContent = sectionData.length > 0;
                    } else {
                         hasContent = !!sectionData;
                    }

                     if (!hasContent) {
                         return null;
                     }

                    return (
                        <section
                            key={sectionInfo.id}
                            id={`profile-${sectionInfo.id}`}
                            className="mb-8 p-5 border border-gray-200 rounded-lg bg-white shadow-sm relative"
                             aria-labelledby={`profile-${sectionInfo.id}-heading`}
                        >
                            <div className="flex justify-between items-center mb-4 min-h-[28px]">
                                 <h2 id={`profile-${sectionInfo.id}-heading`} className="text-xl font-semibold text-black">{sectionInfo.title}</h2>
                            </div>

                             {/* Section Content - REPLICATE DISPLAY LOGIC FROM DASHBOARD */}
                             {/* Ensure you handle potential null/undefined values safely */}

                             {sectionInfo.id === 'experience' && (
                                <ul className="space-y-5">
                                     {(profileData.experience || []).map(exp => (
                                         <li key={exp.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                                             <h3 className="font-semibold text-black">{exp.title || <i className='text-gray-400'>No Title</i>}</h3>
                                             <p className="text-sm text-gray-800">{exp.company || <i className='text-gray-400'>No Company</i>}</p>
                                             <p className="text-xs text-gray-500">
                                                  {isValidDate(exp.startDate) ? formatSimpleDate(exp.startDate) : '?'} - {isValidDate(exp.endDate) ? formatSimpleDate(exp.endDate) : (exp.endDate === 'Present' ? 'Present' : (exp.endDate || '?'))}
                                                  {exp.location && ` | ${exp.location}`}
                                             </p>
                                             {exp.description && (
                                                  <div className="mt-2 text-sm text-gray-700 prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{exp.description}</ReactMarkdown></div>
                                             )}
                                         </li>
                                     ))}
                                 </ul>
                             )}
                             {sectionInfo.id === 'education' && (
                                <ul className="space-y-4">
                                    {(profileData.education || []).map(edu => (
                                        <li key={edu.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                             <h3 className="font-semibold text-black">{edu.institution || <i className='text-gray-400'>No Institution</i>}</h3>
                                             <p className="text-sm text-gray-800">{edu.degree || <i className='text-gray-400'>No Degree</i>}{edu.fieldOfStudy ? `, ${edu.fieldOfStudy}`: ''}</p>
                                            <p className="text-xs text-gray-500">
                                                {isValidDate(edu.startDate) ? formatSimpleDate(edu.startDate) : '?'} - {isValidDate(edu.endDate) ? formatSimpleDate(edu.endDate) : (edu.endDate === 'Present' ? 'Present' : (edu.endDate || '?'))}
                                            </p>
                                            {edu.description && <p className="mt-1 text-sm text-gray-600">{edu.description}</p>}
                                        </li>
                                     ))}
                                </ul>
                             )}
                             {sectionInfo.id === 'certifications' && (
                                <ul className="space-y-4">
                                    {(profileData.certifications || []).map(cert => (
                                        <li key={cert.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                             <div className='flex justify-between items-start gap-2'>
                                                <h3 className="font-semibold text-black">{cert.name || <i className='text-gray-400'>No Certification Name</i>}</h3>
                                                {cert.credentialUrl && (
                                                    <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className='flex-shrink-0 text-xs text-blue-600 hover:underline ml-2 whitespace-nowrap'>
                                                        <LinkIcon size={12} className='inline -mt-px mr-0.5'/> View Credential
                                                    </a>
                                                )}
                                             </div>
                                             <p className="text-sm text-gray-800">{cert.issuer || <i className='text-gray-400'>No Issuer</i>}</p>
                                             <p className="text-xs text-gray-500">
                                                {isValidDate(cert.issueDate) ? `Issued: ${formatSimpleDate(cert.issueDate)}` : ''}
                                                {isValidDate(cert.expirationDate) ? ` | Expires: ${formatSimpleDate(cert.expirationDate)}` : (cert.expirationDate === 'No Expiration' ? ' | No Expiration' : '')}
                                            </p>
                                        </li>
                                     ))}
                                </ul>
                             )}
                              {sectionInfo.id === 'skills' && (
                                 Object.entries(
                                     (profileData.skills || []).reduce((acc, skill) => {
                                         const category = skill.category || 'Other';
                                         if (!acc[category]) acc[category] = [];
                                         acc[category].push(skill);
                                         return acc;
                                     }, {} as Record<string, Array<typeof profileData.skills[0]>>)
                                 ).sort(([catA], [catB]) => catA.localeCompare(catB))
                                 .map(([category, skillsInCategory]) => (
                                     <div key={category} className="mb-3 last:mb-0">
                                         <h4 className='text-sm font-semibold text-gray-600 mb-1.5'>{category}</h4>
                                         <div className="flex flex-wrap gap-2">
                                             {skillsInCategory.map(skill => (
                                                 <span key={skill.id} className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full border border-gray-200">{skill.name || <i className='text-gray-400'>Unnamed Skill</i>}</span>
                                              ))}
                                          </div>
                                      </div>
                                  ))
                               )}
                               {sectionInfo.id === 'languages' && (
                                  <ul className="space-y-1">
                                      {(profileData.languages || []).map(lang => (
                                          <li key={lang.id} className='text-sm text-gray-800'>
                                              <span className='font-medium'>{lang.language || <i className='text-gray-400'>No Language</i>}</span>
                                              {lang.proficiency && <span className='text-gray-600'> ({lang.proficiency})</span>}
                                          </li>
                                       ))}
                                   </ul>
                               )}
                                {sectionInfo.id === 'awards' && (
                                   <ul className="space-y-4">
                                       {(profileData.awards || []).map(award => (
                                           <li key={award.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                               <h3 className="font-semibold text-black">{award.title || <i className='text-gray-400'>No Award Title</i>}</h3>
                                               {(award.issuer || isValidDate(award.date)) && (
                                                   <p className="text-sm text-gray-600">
                                                       {award.issuer}
                                                       {award.issuer && isValidDate(award.date) && ' | '}
                                                       {isValidDate(award.date) ? formatSimpleDate(award.date) : ''}
                                                   </p>
                                               )}
                                               {award.description && <p className="mt-1 text-sm text-gray-700">{award.description}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {sectionInfo.id === 'extracurriculars' && (
                                     <ul className="space-y-5">
                                         {(profileData.extracurriculars || []).map(activity => (
                                             <li key={activity.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                                                 <h3 className="font-semibold text-black">{activity.position || <i className='text-gray-400'>No Position</i>}</h3>
                                                 <p className="text-sm text-gray-800">{activity.organization || <i className='text-gray-400'>No Organization</i>}</p>
                                                 <p className="text-xs text-gray-500">
                                                     {isValidDate(activity.startDate) ? formatSimpleDate(activity.startDate) : '?'} - {isValidDate(activity.endDate) ? formatSimpleDate(activity.endDate) : (activity.endDate === 'Present' ? 'Present' : (activity.endDate || '?'))}
                                                 </p>
                                                 {activity.description && (
                                                     <div className="mt-2 text-sm text-gray-700 prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{activity.description}</ReactMarkdown></div>
                                                 )}
                                              </li>
                                          ))}
                                      </ul>
                                )}
                        </section>
                    );
                })}

                {/* --- Projects Section (Read-Only) --- */}
                 {(projects.length > 0 || (profileData.manualProjects && profileData.manualProjects.length > 0)) && (
                      <section
                          id="profile-projects"
                          className="mb-8 p-5 border border-gray-200 rounded-lg bg-white shadow-sm relative"
                           aria-labelledby="profile-projects-heading"
                      >
                          <div className="flex justify-between items-center mb-4 min-h-[28px]">
                              <h2 id="profile-projects-heading" className="text-xl font-semibold text-black">Projects</h2>
                          </div>

                         {/* Platform Projects Subsection */}
                         <div className="mb-6">
                             <h3 className="text-lg font-medium text-gray-700 mb-3">Platform Projects</h3>
                              {projects.length === 0 ? (
                                   <p className='text-sm text-gray-500 italic'>No platform projects shared by this user.</p>
                              ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                       {projects.map(proj => (
                                          <div key={proj.id}>
                                              <CompactProjectCard project={proj} />
                                          </div>
                                      ))}
                                  </div>
                              )}
                         </div>

                         {/* Manual Projects Subsection */}
                         <div className='mt-4 pt-4 border-t border-gray-200 relative'>
                             <h3 className="text-lg font-medium text-gray-700 mb-3">Other Projects</h3>
                             {(profileData.manualProjects && profileData.manualProjects.length > 0) ? (
                                 <ul className="space-y-4">
                                     {profileData.manualProjects.map(proj => (
                                          <li key={proj.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                              <div className='flex justify-between items-start gap-2'>
                                                  <h4 className="font-semibold text-black">{proj.title || <i className='text-gray-400'>No Project Title</i>}</h4>
                                                  {proj.projectUrl && (
                                                      <a href={proj.projectUrl} target="_blank" rel="noopener noreferrer" className='flex-shrink-0 text-xs text-blue-600 hover:underline ml-2 whitespace-nowrap'>
                                                          <LinkIcon size={12} className='inline -mt-px mr-0.5'/> Link
                                                      </a>
                                                  )}
                                              </div>
                                              {proj.description && (
                                                   <div className="mt-1 text-sm text-gray-700 prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{proj.description}</ReactMarkdown></div>
                                              )}
                                               {proj.skills && proj.skills.length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-2">
                                                      {proj.skills.map((s, index) => (
                                                          <span key={`${s}-${index}`} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">{s}</span>
                                                       ))}
                                                  </div>
                                              )}
                                           </li>
                                        ))}
                                     </ul>
                                 ) : (
                                     <p className="text-sm text-gray-500 italic">No other projects listed by this user.</p>
                                 )}
                             </div>
                          </section>
                 )}

                {/* --- Community Posts Section (Read-Only) --- */}
                 {/* Only render the Posts section if there are posts OR loading/error states */}
                 {(posts.length > 0 || postsLoading || postsError) && (
                    <section
                        id="profile-posts"
                        className="mb-8 p-5 border border-gray-200 rounded-lg bg-white shadow-sm relative"
                        aria-labelledby="profile-posts-heading"
                    >
                        <div className="flex justify-between items-center mb-4 min-h-[28px]">
                            <h2 id="profile-posts-heading" className="text-xl font-semibold text-black">Community Posts</h2>
                            {/* Optional: Link to view all posts by this user if that page exists */}
                             {posts.length > 0 && targetUserId && (
                                 <Link href={`/community?userId=${targetUserId}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-medium">
                                     View All <ChevronRight size={16}/>
                                 </Link>
                             )}
                        </div>

                        {/* --- Render the list of posts --- */}
                        {/* This block handles loading, error, empty states, and the actual list */}
                        {postsLoading ? (
                            <div className="flex justify-center items-center text-gray-500 py-4">
                               <Loader2 className="animate-spin mr-2"/> Loading posts...
                            </div>
                        ) : postsError ? (
                            <p className='text-sm text-red-500 italic px-2 py-1 bg-red-50 border border-red-200 rounded'>Error loading posts: {postsError}</p>
                        ) : posts.length === 0 ? (
                            <p className='text-sm text-gray-500 italic'>No community posts found for this user.</p>
                        ) : (
                            <ul className="space-y-4">
                                {posts.map(post => (
                                     // --- Example: Using a simplified structure, or use a CommunityPostCard ---
                                    // Assuming post.id is always available for items from the API
                                    <li key={post.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                        {/* Link to the specific post's detail page if you have one (/community/[postId]) */}
                                        {/* Ensure post.id exists before linking */}
                                        {post.id ? (
                                            <Link href={`/community/${post.id}`} className="block hover:bg-gray-50 p-2 -mx-2 rounded transition-colors">
                                                 {/* Display post summary */}
                                                 {/* Use textContent as per your backend type */}
                                                 {post.textContent && (
                                                     <p className="text-sm text-gray-800 line-clamp-3">{post.textContent}</p> // Show truncated text
                                                 )}
                                                 {post.linkUrl && (
                                                     <p className="text-xs text-blue-600 hover:underline mt-1"><LinkIcon size={12} className='inline -mt-px mr-0.5'/> {post.linkUrl}</p>
                                                 )}
                                                  {/* Add image/media preview if needed - Requires checking post.mediaUrls */}
                                                 {/* Display likes/comments if returned by API */}
                                                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                                      {typeof post.likeCount === 'number' && <span>{post.likeCount} Likes</span>}
                                                      {typeof post.commentCount === 'number' && <span>{post.commentCount} Comments</span>}
                                                      {/* Format date - assuming post.createdAt is ISO string */}
                                                      {post.createdAt && <span>{formatSimpleDate(new Date(post.createdAt))}</span>}
                                                  </div>
                                             </Link>
                                        ) : (
                                             // Handle case where post.id is missing (shouldn't happen if API is correct)
                                             <div className="text-sm text-gray-500 italic p-2 -mx-2">Invalid post data</div>
                                        )}
                                    </li>
                                     // --- End Example ---
                                    // OR, if you have a reusable card component like CommunityPostCard:
                                    // {post.id && ( // Ensure post has an ID before rendering card
                                    //    <li key={post.id}>
                                    //       <CommunityPostCard post={post} isProfileView={true} /> // Pass prop to simplify card
                                    //    </li>
                                    // )}
                                ))}
                            </ul>
                        )}
                    </section>
                 )}


             </main>
        </div>
    );
}