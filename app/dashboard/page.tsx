// app/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, getAuth, onAuthStateChanged, getIdToken } from 'firebase/auth';
import firebaseApp from '@/app/firebase'; // Default export
import Image from 'next/image'; // Keep import if needed elsewhere, but we'll use <img> for main avatar
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Project } from '@/lib/types/project'; // Existing type
import { formatSimpleDate, formatFullTimestamp } from '@/lib/dateUtils'; // Date formatting
import { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking

// --- Import ALL Components ---
// Ensure these paths are correct for your project structure
import CompactProjectCard from '@/components/CompactProjectCard';
import Modal from '@/components/Modal';
import DashboardSidebar from '@/components/DashboardSidebar';
// --- Import ALL Edit Forms ---
import EditSummaryForm from '@/components/EditSummaryForm';
import EditExperienceForm from '@/components/EditExperienceForm';
import EditEducationForm from '@/components/EditEducationForm';
import EditCertificationsForm from '@/components/EditCertificationsForm';
import EditSkillsForm from '@/components/EditSkillsForm';
import EditLanguagesForm from '@/components/EditLanguagesForm';
import EditAwardsForm from '@/components/EditAwardsForm';
import EditExtracurricularsForm from '@/components/EditExtracurricularsForm';
import EditManualProjectsForm from '@/components/EditManualProjectsForm';
import EditHeaderForm from '@/components/EditHeaderForm';

// --- Import Icons ---
import { Loader2, Edit, Link as LinkIcon, Linkedin, Github, Globe, Mail, Phone, PlusCircle, ChevronDown, ChevronUp, EyeOff, Eye } from 'lucide-react';

// TODO: Consider moving this entire interface to lib/types/profile.ts
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
    updatedAt?: any; // Consider Timestamp type from Firestore
}

// Define sections for sidebar navigation
const dashboardSections = [
    { id: 'summary', title: 'Summary' },
    { id: 'experience', title: 'Experience' },
    { id: 'education', title: 'Education' },
    { id: 'certifications', title: 'Licenses & Certs' },
    { id: 'projects', title: 'Projects' }, // Combined view now
    { id: 'skills', title: 'Skills' },
    { id: 'languages', title: 'Languages' },
    { id: 'awards', title: 'Honors & Awards' },
    { id: 'extracurriculars', title: 'Activities' },
];

// Helper function to get initials from name or email
// TODO: Move to a shared utility file
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

// Simple URL validation (basic syntax check for http/https)
// TODO: Move to a shared utility file
const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || url.trim() === '') return true; // Allow empty string, null, undefined as valid (for optional fields)
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch (_) {
        return false;
    }
};


// Improved Date Validation (Handles Firestore Timestamps, JS Dates, and basic strings)
// TODO: Consider moving to lib/dateUtils.ts or lib/validationUtils.ts
function isValidDate(date: any): date is Date | Timestamp {
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
             return !isNaN(new Date(date).getTime());
         }
    } catch {
        return false;
    }
    return false;
}

const HIDDEN_PROJECTS_STORAGE_KEY = 'dashboard_hidden_projects';

export default function DashboardPage() {
    const router = useRouter();
    const auth = getAuth(firebaseApp);

    // --- State ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [profileData, setProfileData] = useState<StudentProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]); // Keep initialized as array
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editSection, setEditSection] = useState<string | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null); // For sidebar highlighting
    const [isPlatformProjectsVisible, setIsPlatformProjectsVisible] = useState(true);
    const [hiddenProjectIds, setHiddenProjectIds] = useState<string[]>([]);
    const [showHiddenList, setShowHiddenList] = useState(false);

    // State to track if the main profile image failed to load
    const [mainPhotoLoadError, setMainPhotoLoadError] = useState(false);

    const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

    // --- Reset mainPhotoLoadError when profileData.photoURL changes ---
    useEffect(() => {
        setMainPhotoLoadError(false);
    }, [profileData?.photoURL]);


    // --- Load Hidden Projects ---
    useEffect(() => {
        const storedHidden = localStorage.getItem(HIDDEN_PROJECTS_STORAGE_KEY);
        if (storedHidden) {
            try {
                setHiddenProjectIds(JSON.parse(storedHidden));
            } catch (error) {
                console.error("Failed to parse hidden projects from localStorage:", error);
                setHiddenProjectIds([]); // Reset if parsing fails
            }
        }
    }, []);

    // --- Authentication ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                console.log("User authenticated:", user.uid);
            } else {
                setCurrentUser(null);
                console.log("User not authenticated, redirecting to login.");
                router.push('/login'); // Redirect to login if not authenticated
            }
            setAuthLoading(false);
        });
        return () => unsubscribe(); // Cleanup subscription
    }, [auth, router]);

    // --- Data Fetching ---
    const fetchProfile = useCallback(async () => {
        if (!currentUser) {
            console.log("fetchProfile skipped: No current user.");
            return;
        }
        console.log("fetchProfile started for user:", currentUser.uid);
        setProfileLoading(true);
        setProfileError(null);
        try {
            const token = await getIdToken(currentUser);
            // Fetch profile from the base /api/profile endpoint
            const response = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Failed to fetch profile: ${response.status} ${errorData.message || ''}`);
            }
             // Expecting { profile: StudentProfile } structure from API
            const responseData = await response.json();
            if (!responseData.profile) {
                throw new Error("Profile data not found in API response.");
            }
            const data: StudentProfile = responseData.profile;
            console.log("Profile data fetched successfully:", data);
            setProfileData(data);
        } catch (err: any) {
            console.error("Error fetching profile:", err);
            setProfileError(err.message || 'An unknown error occurred while fetching profile.');
            setProfileData(null); // Ensure data is null on error
        } finally {
            setProfileLoading(false);
            console.log("fetchProfile finished.");
        }
    }, [currentUser]);

    const fetchProjects = useCallback(async () => {
        if (!currentUser) {
             console.log("fetchProjects skipped: No current user.");
            return;
        }
        console.log("fetchProjects started for user:", currentUser.uid);
        setProjectsLoading(true);
        setProjectsError(null);
        try {
            const token = await getIdToken(currentUser);
            // Fetch projects from the main /api/projects endpoint.
            const response = await fetch('/api/projects', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Failed to fetch projects: ${response.status} ${errorData.message || ''}`);
            }

             // Assumed API returns { projects: Project[] } - ADJUST THIS IF YOUR API RETURNS A DIFFERENT STRUCTURE
            const responseData = await response.json();
            if (responseData && Array.isArray(responseData.projects)) {
                const data: Project[] = responseData.projects; // Extract the projects array
                console.log("Projects data fetched successfully:", data);
                setProjects(data);
            } else {
                 console.error("API response for projects did not contain an array at 'projects'. Received:", responseData);
                 setProjects([]); // Set to empty array to prevent errors
                 setProjectsError("Received unexpected data format for projects.");
            }

        } catch (err: any) {
            console.error("Error fetching projects:", err);
            setProjectsError(err.message || 'An unknown error occurred while fetching projects.');
             setProjects([]); // Ensure data is empty array on error
        } finally {
            setProjectsLoading(false);
            console.log("fetchProjects finished.");
        }
    }, [currentUser]);

    // Trigger fetches when user is available and auth is complete
    useEffect(() => {
        if (currentUser && !authLoading) {
            console.log("Auth complete, user found. Triggering data fetches.");
            fetchProfile();
            fetchProjects();
        } else if (!authLoading && !currentUser) {
             console.log("Auth complete, no user found. Skipping data fetches.");
             // Clear profile/project state if user logs out
             setProfileData(null);
             setProjects([]);
             setProfileLoading(false); // Ensure loading stops if no user
             setProjectsLoading(false);
        }
    }, [currentUser, authLoading, fetchProfile, fetchProjects]);

    // --- Intersection Observer for Sidebar Highlighting ---
    useEffect(() => {
        const observerCallback: IntersectionObserverCallback = (entries) => {
             const visibleSections = entries.filter(e => e.isIntersecting).sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
             if (visibleSections.length > 0) {
                setActiveSectionId(visibleSections[0].target.id);
             }
         };

        const observerOptions: IntersectionObserverInit = {
             root: null, // Use viewport as root
             rootMargin: '-25% 0px -75% 0px', // Section active when its top is between 25% and 75% from viewport top
             threshold: 0, // Trigger as soon as any part becomes visible within margin
         };

         const observer = new IntersectionObserver(observerCallback, observerOptions);

        // Only observe if profile data is loaded (sections exist)
        const elementsToObserve = Object.values(sectionRefs.current).filter(el => el !== null) as Element[];
        if (profileData && !profileLoading && elementsToObserve.length > 0) {
             elementsToObserve.forEach(el => observer.observe(el));
             // Also observe the profile header if it exists
             const headerEl = sectionRefs.current['profile-header'];
             if (headerEl) observer.observe(headerEl);
        }

         return () => {
            // Clean up: disconnect observer
             elementsToObserve.forEach(el => {
                 if (el) observer.unobserve(el);
             });
             const headerEl = sectionRefs.current['profile-header'];
             if (headerEl) observer.unobserve(headerEl);
             observer.disconnect();
         };
    }, [profileData, profileLoading, sectionRefs]); // Re-run observer setup if profile data loads


    // --- Project Hide/Unhide ---
    const hideProject = (projectId: string) => {
        if (!projectId) return;
        setHiddenProjectIds(prev => {
            const newHidden = [...new Set([...prev, projectId])];
            localStorage.setItem(HIDDEN_PROJECTS_STORAGE_KEY, JSON.stringify(newHidden));
            return newHidden;
        });
    };

    const unhideProject = (projectId: string) => {
        if (!projectId) return;
        setHiddenProjectIds(prev => {
            const newHidden = prev.filter(id => id !== projectId);
            localStorage.setItem(HIDDEN_PROJECTS_STORAGE_KEY, JSON.stringify(newHidden));
            return newHidden;
        });
    };

    // --- Memoized Filtered Projects ---
    const visiblePlatformProjects = useMemo(() => projects.filter(p => p.id && !hiddenProjectIds.includes(p.id)), [projects, hiddenProjectIds]);
    const hiddenPlatformProjects = useMemo(() => projects.filter(p => p.id && hiddenProjectIds.includes(p.id)), [projects, hiddenProjectIds]);

    // --- Edit Handlers ---
    const handleEditClick = (sectionId: string) => {
        // Ensure profileData is loaded before opening modal
        if (!profileData) {
            console.warn("Attempted to open edit modal before profile data loaded.");
            return;
        }
        setEditSection(sectionId);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditSection(null);
    };

    const handleProfileUpdateSuccess = () => {
        closeEditModal();
        console.log("Profile update successful, refetching profile data...");
        fetchProfile(); // Refetch profile data to show updates
        // No need to refetch projects here unless manual projects were updated
    };

    // --- Render Loading/Error States ---
    if (authLoading) {
        return (
            <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                <Loader2 className="animate-spin text-gray-500" size={32} />
                <span className="ml-2 text-gray-500">Loading User...</span>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                 <Loader2 className="animate-spin text-gray-500" size={32} />
                 <span className="ml-2 text-gray-500">Redirecting...</span>
            </div>
        );
    }

    if (profileLoading) {
         return (
             <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                <Loader2 className="animate-spin text-gray-500" size={32} />
                <span className="ml-2 text-gray-500">Loading Profile...</span>
             </div>
         );
    }

    if (profileError) {
        return (
            <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                <div className="text-center p-10 bg-white border border-red-200 rounded-lg shadow-md max-w-md">
                    <p className="text-red-600 font-semibold text-lg">Error Loading Profile</p>
                    <p className="text-red-500 text-sm mt-2 mb-4">{profileError}</p>
                    <button
                        onClick={fetchProfile}
                        className='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!profileData) {
         return (
            <div className="flex pt-16 bg-gray-50 min-h-screen justify-center items-center">
                 <div className="text-center p-10 bg-white border border-yellow-300 rounded-lg shadow-sm">
                    <p className="text-gray-700 font-medium">Could not load profile data.</p>
                    <p className="text-sm text-gray-500 mt-1">Profile data might be missing or failed to load correctly.</p>
                     <button onClick={() => window.location.reload()} className='mt-4 text-sm text-blue-600 hover:underline'>Refresh Page</button>
                 </div>
            </div>
         );
    }

    // --- Determine whether to show image or fallback avatar ---
    const displayPhotoURL = profileData.photoURL?.trim(); // Use trimmed URL
    const showMainImage = displayPhotoURL && isValidUrl(displayPhotoURL) && !mainPhotoLoadError;

    // --- Main Render Function ---
    return (
        <div className="flex pt-16 bg-gray-50 min-h-screen"> {/* Navbar height offset */}

            {/* Sidebar */}
            <aside className="hidden md:block w-56 lg:w-64 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4 border-r border-gray-200 bg-white"> {/* Adjust top/h based on actual navbar height */}
                <DashboardSidebar sections={dashboardSections} activeSectionId={activeSectionId} />
            </aside>

            {/* Main Content Area */}
            <main className="flex-grow p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto">

                 {/* --- Profile Header Section --- */}
                 <section
                    id="profile-header" // ID for potential scroll-spy or direct linking
                    ref={el => sectionRefs.current['profile-header'] = el}
                    className="mb-8 lg:mb-10 p-6 border border-gray-200 rounded-lg bg-white shadow-sm relative scroll-mt-20" // scroll-mt for scroll spy offset
                 >
                    <button
                        onClick={() => handleEditClick('header')}
                        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                        aria-label="Edit header"
                    >
                        <Edit size={16}/>
                    </button>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {/* --- Avatar Display Logic --- */}
                        {showMainImage ? (
                             // Display Image using standard <img> tag
                            <img
                                src={displayPhotoURL}
                                alt={profileData.name ? `${profileData.name}'s profile picture` : 'User profile picture'}
                                // Set explicit width/height or rely purely on Tailwind classes for size
                                width={100}
                                height={100}
                                className="rounded-full object-cover border-2 border-gray-300 flex-shrink-0 w-24 h-24 sm:w-[100px] sm:h-[100px]" // Use explicit Tailwind size
                                onError={() => {
                                    console.warn("Main profile image failed to load from URL:", displayPhotoURL);
                                    setMainPhotoLoadError(true); // Trigger fallback on error
                                }}
                            />
                        ) : (
                            // Fallback: Initials avatar
                            <div className="w-24 h-24 sm:w-[100px] sm:h-[100px] rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-4xl font-medium border-2 border-gray-300 flex-shrink-0">
                                {/* Use getInitials helper with profile data name and currentUser email */}
                                {getInitials(profileData.name, currentUser.email)}
                            </div>
                        )}
                        {/* --- End Avatar Display Logic --- */}

                        <div className='text-center sm:text-left min-w-0 flex-grow'> {/* Ensure div takes space */}
                            <h1 className="text-2xl md:text-3xl font-bold text-black truncate" title={profileData.name || 'User Name'}>
                                {profileData.name || <span className="italic text-gray-500">Add your name</span>}
                            </h1>
                            <p className="text-md md:text-lg text-gray-700 mt-1 truncate" title={profileData.headline || "Your professional headline"}>
                                {profileData.headline || <span className="italic text-gray-500">Add your headline</span>}
                            </p>
                            {/* Contact Info */}
                             <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-3 text-gray-600">
                                {/* Add checks for profileData.contactInfo before accessing */}
                                {/* Email is always shown from auth if profileData doesn't have it */}
                                {(profileData.contactInfo?.email || currentUser.email) && (
                                    <a href={`mailto:${profileData.contactInfo?.email || currentUser.email}`} className="flex items-center gap-1 text-sm hover:text-blue-600 hover:underline transition-colors" aria-label="Email">
                                        <Mail size={14}/> {profileData.contactInfo?.email || currentUser.email}
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
                                {profileData.contactInfo?.phone && (
                                    <span className="flex items-center gap-1 text-sm" aria-label="Phone Number">
                                        <Phone size={14}/> {profileData.contactInfo.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                 </section>

                {/* --- Widget Placeholders (Example) --- */}
                <section className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Example Widget 1 */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-black mb-2">Upcoming</h3>
                        <p className="text-sm text-gray-500 italic">Placeholder: Upcoming events/deadlines...</p>
                    </div>
                    {/* Example Widget 2 */}
                    <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <h3 className="font-semibold text-black mb-2">Profile Status</h3>
                        <p className="text-sm text-gray-500 italic">Placeholder: Profile completion...</p>
                    </div>
                     {/* Example Widget 3 - Quick Links */}
                     <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm md:col-span-1 lg:col-span-1">
                        <h3 className="font-semibold text-black mb-2">Quick Actions</h3>
                        <div className="flex flex-col space-y-1">
                            <a href="/community/create" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">Create Community Post</a>
                            <a href="/projects/create" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">Start New Project</a>
                             <a href="/resources" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">Find Resources</a>
                             {/* Add more relevant links */}
                        </div>
                    </div>
                </section>

                {/* --- Render main sections dynamically --- */}
                {dashboardSections.map((sectionInfo) => {
                    let hasContent = false;
                    let sectionData: any = null; // Initialize sectionData

                    try {
                        // Handle potential issues if profileData is missing keys unexpectedly
                        sectionData = profileData[sectionInfo.id as keyof StudentProfile];
                    } catch (e) {
                         console.warn(`Error accessing section data for ${sectionInfo.id}:`, e);
                    }

                    if (sectionInfo.id === 'summary') {
                        hasContent = !!profileData.summary;
                    } else if (sectionInfo.id === 'projects') {
                        hasContent = true; // Structure always shown, content checked inside
                    } else if (Array.isArray(sectionData)) {
                        hasContent = sectionData.length > 0;
                    }
                    // No need for separate manualProjects check here as it's handled within the 'projects' section render

                     const singularTitle = sectionInfo.title.replace(/s$/, '');

                    return (
                        <section
                            key={sectionInfo.id}
                            id={sectionInfo.id}
                            ref={el => sectionRefs.current[sectionInfo.id] = el}
                            className="mb-8 p-5 border border-gray-200 rounded-lg bg-white shadow-sm relative scroll-mt-20" // scroll-mt matches header height + buffer
                            aria-labelledby={`${sectionInfo.id}-heading`}
                        >
                            {/* Section Header */}
                            <div className="flex justify-between items-center mb-4 min-h-[28px]"> {/* Ensure consistent height */}
                                <h2 id={`${sectionInfo.id}-heading`} className="text-xl font-semibold text-black">{sectionInfo.title}</h2>
                                {/* Edit button - Show for all sections except Projects main container */}
                                {sectionInfo.id !== 'projects' && (
                                    <button
                                        onClick={() => handleEditClick(sectionInfo.id)}
                                        className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                                        aria-label={`Edit ${sectionInfo.title}`}
                                    >
                                        <Edit size={16}/>
                                    </button>
                                )}
                            </div>

                            {/* Section Content - Render based on sectionInfo.id */}
                            {sectionInfo.id === 'summary' && (
                                hasContent ? (
                                    <div className="text-base text-gray-800 whitespace-pre-wrap prose prose-sm max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{profileData.summary!}</ReactMarkdown>
                                    </div>
                                ) : (
                                     <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">Showcase your background and goals.</p>
                                        <button onClick={() => handleEditClick('summary')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Summary </button>
                                    </div>
                                )
                            )}

                            {sectionInfo.id === 'experience' && (
                                hasContent ? (
                                    <>
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
                                        <button onClick={() => handleEditClick('experience')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add Another Experience </button>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">Detail your work history.</p>
                                        <button onClick={() => handleEditClick('experience')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Experience </button>
                                     </div>
                                )
                            )}

                             {sectionInfo.id === 'education' && (
                                hasContent ? (
                                     <>
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
                                        <button onClick={() => handleEditClick('education')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add Another Education </button>
                                    </>
                                ) : (
                                     <div className="text-center py-4">
                                         <p className="text-sm text-gray-500 italic mb-2">List your academic background.</p>
                                         <button onClick={() => handleEditClick('education')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Education </button>
                                     </div>
                                )
                            )}

                            {/* --- Certifications --- */}
                            {sectionInfo.id === 'certifications' && (
                                hasContent ? (
                                     <>
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
                                        <button onClick={() => handleEditClick('certifications')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add Another Certification </button>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">Add licenses or certifications.</p>
                                        <button onClick={() => handleEditClick('certifications')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Certification </button>
                                    </div>
                                )
                            )}

                            {/* --- Skills --- */}
                            {sectionInfo.id === 'skills' && (
                                hasContent ? (
                                     <>
                                        {/* Group skills by category */}
                                        {Object.entries(
                                            (profileData.skills || []).reduce((acc, skill) => {
                                                const category = skill.category || 'Other';
                                                if (!acc[category]) acc[category] = [];
                                                acc[category].push(skill);
                                                return acc;
                                            }, {} as Record<string, Array<typeof profileData.skills[0]>>)
                                        ).sort(([catA], [catB]) => catA.localeCompare(catB)) // Sort categories alphabetically
                                        .map(([category, skillsInCategory]) => (
                                            <div key={category} className="mb-3 last:mb-0">
                                                <h4 className='text-sm font-semibold text-gray-600 mb-1.5'>{category}</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {skillsInCategory.map(skill => (
                                                        <span key={skill.id} className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full border border-gray-200">{skill.name || <i className='text-gray-400'>Unnamed Skill</i>}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                         <button onClick={() => handleEditClick('skills')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add/Edit Skills </button>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">Highlight your capabilities.</p>
                                        <button onClick={() => handleEditClick('skills')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Skills </button>
                                    </div>
                                )
                            )}

                            {/* --- Languages --- */}
                            {sectionInfo.id === 'languages' && (
                                hasContent ? (
                                    <>
                                        <ul className="space-y-1">
                                            {(profileData.languages || []).map(lang => (
                                                <li key={lang.id} className='text-sm text-gray-800'>
                                                    <span className='font-medium'>{lang.language || <i className='text-gray-400'>No Language</i>}</span>
                                                    {lang.proficiency && <span className='text-gray-600'> ({lang.proficiency})</span>}
                                                </li>
                                            ))}
                                        </ul>
                                        <button onClick={() => handleEditClick('languages')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add/Edit Languages </button>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">List languages you speak.</p>
                                        <button onClick={() => handleEditClick('languages')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Languages </button>
                                    </div>
                                )
                            )}

                             {/* --- Awards --- */}
                             {sectionInfo.id === 'awards' && (
                                hasContent ? (
                                    <>
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
                                        <button onClick={() => handleEditClick('awards')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add Another Honor/Award </button>
                                    </>
                                ) : (
                                     <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">Showcase your achievements.</p>
                                        <button onClick={() => handleEditClick('awards')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Honors & Awards </button>
                                    </div>
                                )
                            )}

                             {/* --- Extracurriculars --- */}
                            {sectionInfo.id === 'extracurriculars' && (
                                hasContent ? (
                                     <>
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
                                        <button onClick={() => handleEditClick('extracurriculars')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add Another Activity </button>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm text-gray-500 italic mb-2">Detail your activities.</p>
                                        <button onClick={() => handleEditClick('extracurriculars')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Activities </button>
                                     </div>
                                )
                            )}


                            {/* --- Projects Section (Combined Platform & Manual) --- */}
                            {sectionInfo.id === 'projects' && (
                                <>
                                    {/* Platform Projects Subsection */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="text-lg font-medium text-gray-700">Platform Projects</h3>
                                            <button
                                                onClick={() => setIsPlatformProjectsVisible(!isPlatformProjectsVisible)}
                                                className="text-xs text-gray-600 hover:text-black flex items-center gap-1 p-1 focus:outline-none"
                                                aria-expanded={isPlatformProjectsVisible}
                                            >
                                                {isPlatformProjectsVisible ? <ChevronUp size={14}/> : <ChevronDown size={14} />}
                                                {isPlatformProjectsVisible ? 'Hide Grid' : 'Show Grid'}
                                            </button>
                                        </div>

                                        {projectsLoading && (
                                            <div className="flex items-center justify-center text-sm text-gray-500 py-4">
                                                <Loader2 className="animate-spin mr-2" size={16} /> Loading platform projects...
                                            </div>
                                        )}
                                        {projectsError && !projectsLoading && (
                                             <p className='text-sm text-red-500 italic px-2 py-1 bg-red-50 border border-red-200 rounded'>Error loading projects: {projectsError}</p>
                                        )}

                                        {!projectsLoading && !projectsError && isPlatformProjectsVisible && (
                                            visiblePlatformProjects.length === 0 && hiddenProjectIds.length === 0 ? (
                                                <p className='text-sm text-gray-500 italic'>No platform projects found for your account yet.</p>
                                            ) : visiblePlatformProjects.length === 0 && hiddenProjectIds.length > 0 ? (
                                                <p className='text-sm text-gray-500 italic'>All platform projects are currently hidden. (See below)</p>
                                            ) : (
                                                // Grid for Visible Projects
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                                     {visiblePlatformProjects.map(proj => (
                                                        <div key={proj.id} className="relative group">
                                                            <CompactProjectCard project={proj} />
                                                            {/* Hide Button */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); proj.id && hideProject(proj.id); }}
                                                                className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white text-gray-500 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150 ease-in-out shadow-sm"
                                                                aria-label={`Hide project ${proj.title}`}
                                                                title={`Hide project "${proj.title}"`}
                                                            >
                                                                <EyeOff size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        )}

                                        {/* Hidden Projects List Toggle */}
                                        {hiddenPlatformProjects.length > 0 && (
                                            <div className='mt-4 pt-3 border-t border-dashed border-gray-200'>
                                                <button
                                                    onClick={() => setShowHiddenList(!showHiddenList)}
                                                    className='text-xs text-gray-600 hover:text-black flex items-center gap-1 mb-2 font-medium focus:outline-none'
                                                >
                                                    {showHiddenList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    Show {hiddenPlatformProjects.length} Hidden Project(s)
                                                </button>
                                                {showHiddenList && (
                                                    <ul className='space-y-1 pl-2'>
                                                        {hiddenPlatformProjects.map(proj => (
                                                            <li key={proj.id} className='flex justify-between items-center group text-sm py-0.5'>
                                                                <span className='text-gray-700 truncate pr-2' title={proj.title || 'Untitled Project'}>
                                                                    {proj.title || <i className="text-gray-400">Untitled Project</i>}
                                                                </span>
                                                                {/* Unhide Button */}
                                                                <button
                                                                    onClick={() => proj.id && unhideProject(proj.id)}
                                                                    className='p-1 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-colors'
                                                                    aria-label={`Unhide project ${proj.title}`}
                                                                    title={`Unhide project "${proj.title}"`}
                                                                >
                                                                    <Eye size={14}/>
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Manual Projects Subsection */}
                                    <div className='mt-4 pt-4 border-t border-gray-200 relative'>
                                         <button
                                            onClick={() => handleEditClick('manualProjects')}
                                            className="absolute top-3 right-0 p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                                            aria-label="Add or Edit other projects"
                                        >
                                             <Edit size={16}/>
                                        </button>
                                        <h3 className="text-lg font-medium text-gray-700 mb-3">Other Projects</h3>
                                        {/* Check profileData.manualProjects exists and has length */}
                                        {(profileData.manualProjects && profileData.manualProjects.length > 0) ? (
                                            <>
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
                                                 <button onClick={() => handleEditClick('manualProjects')} className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"> <PlusCircle size={16}/> Add Another Project </button>
                                            </>
                                        ) : (
                                            <div className="text-center py-4">
                                                <p className="text-sm text-gray-500 italic mb-2">Add personal projects, coursework, etc.</p>
                                                <button onClick={() => handleEditClick('manualProjects')} className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"> <PlusCircle size={16}/> Add Other Project </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                             {/* Generic "Add" button logic (For sections NOT handled explicitly above and NOT 'projects') */}
                             {!['summary', 'experience', 'education', 'certifications', 'skills', 'languages', 'awards', 'extracurriculars', 'projects'].includes(sectionInfo.id) && !hasContent && (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500 italic mb-2">Add your {sectionInfo.title.toLowerCase()}.</p>
                                    <button
                                        onClick={() => handleEditClick(sectionInfo.id)}
                                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium mx-auto"
                                    >
                                        <PlusCircle size={16}/> Add {sectionInfo.title}
                                    </button>
                                </div>
                             )}
                             {/* Generic "Add Another" button (For list-type sections NOT handled explicitly above and NOT 'projects') */}
                             {!['summary', 'experience', 'education', 'certifications', 'skills', 'languages', 'awards', 'extracurriculars', 'projects'].includes(sectionInfo.id) && hasContent && Array.isArray(sectionData) && (
                                <button
                                    onClick={() => handleEditClick(sectionInfo.id)}
                                    className="mt-4 text-sm text-gray-700 hover:text-black hover:underline flex items-center gap-1 font-medium"
                                >
                                    <PlusCircle size={16}/> Add Another {singularTitle}
                                </button>
                             )}

                        </section>
                    );
                })}

                {/* --- Edit Modal --- */}
                {isEditModalOpen && editSection && currentUser && profileData && (
                     <Modal isOpen={isEditModalOpen} onClose={closeEditModal} title={`Edit ${dashboardSections.find(s => s.id === editSection)?.title || 'Section'}`}>
                         {/* Conditionally render the correct form based on editSection */}
                         {editSection === 'header' && (<EditHeaderForm currentUser={currentUser} initialProfileData={profileData} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'summary' && (<EditSummaryForm currentUser={currentUser} initialSummary={profileData.summary || ''} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'experience' && (<EditExperienceForm currentUser={currentUser} initialExperience={profileData.experience || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'education' && (<EditEducationForm currentUser={currentUser} initialEducation={profileData.education || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'certifications' && (<EditCertificationsForm currentUser={currentUser} initialCertifications={profileData.certifications || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'skills' && (<EditSkillsForm currentUser={currentUser} initialSkills={profileData.skills || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'languages' && (<EditLanguagesForm currentUser={currentUser} initialLanguages={profileData.languages || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'awards' && (<EditAwardsForm currentUser={currentUser} initialAwards={profileData.awards || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'extracurriculars' && (<EditExtracurricularsForm currentUser={currentUser} initialActivities={profileData.extracurriculars || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}
                         {editSection === 'manualProjects' && (<EditManualProjectsForm currentUser={currentUser} initialProjects={profileData.manualProjects || []} onSuccess={handleProfileUpdateSuccess} onCancel={closeEditModal} />)}

                         {/* Fallback message if a section is clicked but no form exists */}
                         {!['header', 'summary', 'experience', 'education', 'certifications', 'skills', 'languages', 'awards', 'extracurriculars', 'manualProjects'].includes(editSection) && (
                              <div className="p-6 text-center">
                                 <p className="text-red-600">Edit form for "{editSection}" is not implemented yet.</p>
                                 <button onClick={closeEditModal} className='mt-4 px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors'>Close</button>
                             </div>
                         )}
                     </Modal>
                 )}
            </main>
        </div>
    );
}