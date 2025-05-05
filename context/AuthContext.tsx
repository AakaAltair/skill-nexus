// context/AuthContext.tsx
"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, Firestore, setDoc, serverTimestamp } from 'firebase/firestore'; // Import setDoc, serverTimestamp
import app from '@/app/firebase';

// --- Define UserProfile and UserRole ---
interface UserProfile {
    uid: string;
    role?: 'student' | 'admin' | 'coordinator' | 'guest'; // Adjusted roles
    displayName?: string | null; // Allow null from Firebase
    photoURL?: string | null; // Allow null from Firebase
    email?: string | null; // Add email
    createdAt?: Date | null; // Add timestamps
    lastLoginAt?: Date | null;
    branch?: string;
    year?: string;
    // ... other profile fields
}
type UserRole = UserProfile['role'];

// --- Define Context Shape ---
interface AuthContextType {
    currentUser: FirebaseUser | null;
    userProfile: UserProfile | null;
    userRole: UserRole | null;
    // --- Renamed for clarity: Represents combined loading state ---
    isLoading: boolean; // True until initial auth AND profile checks are complete
    // --- Optional: Keep profile loading separate if needed ---
    // isProfileLoading: boolean;
}

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom Hook
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) { throw new Error('useAuth must be used within an AuthProvider'); }
    return context;
};

// AuthProvider Component
interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    // --- isLoading tracks the COMBINED state ---
    const [isLoading, setIsLoading] = useState(true); // Starts true
    // Internal state to track if the initial onAuthStateChanged has fired
    const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);
    // Internal state to track if profile fetch is running
    const [isFetchingProfile, setIsFetchingProfile] = useState(false);

    const auth = getAuth(app);
    const db = getFirestore(app);

    // --- Effect: Firebase Auth State Listener ---
    useEffect(() => {
        console.log("AuthContext: Setting up Firebase listener...");
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("AuthContext: Auth state changed. User:", user ? user.uid : null);
            setCurrentUser(user); // Update Firebase user state

            if (user) {
                // User signed in - Start fetching profile
                setIsFetchingProfile(true); // Mark profile fetch as starting
                setUserProfile(null); // Clear previous profile while fetching
                setUserRole(null);

                const userProfileRef = doc(db as Firestore, 'userProfiles', user.uid); // Use 'userProfiles' collection
                try {
                    const docSnap = await getDoc(userProfileRef);
                    let profileData: UserProfile | null = null;

                    if (docSnap.exists()) {
                        // --- Profile Exists ---
                        const data = docSnap.data();
                        profileData = {
                            uid: user.uid,
                            email: data.email || user.email,
                            displayName: data.displayName || user.displayName,
                            photoURL: data.photoURL || user.photoURL,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                            lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(),
                            role: data.role || 'student', // Default role if missing
                            branch: data.branch || '',
                            year: data.year || '',
                            // ... other fields
                        };
                        console.log("AuthContext: Profile found:", profileData);
                        // Update last login (don't wait for it)
                        setDoc(userProfileRef, { lastLoginAt: serverTimestamp() }, { merge: true })
                            .catch(err => console.error("AuthContext: Failed to update lastLoginAt", err));

                    } else {
                        // --- Create New Profile ---
                        console.warn(`AuthContext: No profile for ${user.uid}. Creating default.`);
                        profileData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            createdAt: new Date(),
                            lastLoginAt: new Date(),
                            role: 'student', // Default role
                            branch: '',
                            year: '',
                        };
                        await setDoc(userProfileRef, {
                            ...profileData,
                            createdAt: serverTimestamp(), // Use server timestamp on creation
                            lastLoginAt: serverTimestamp(),
                            role: profileData.role, // Explicitly save role
                        });
                        console.log("AuthContext: New profile created.");
                    }
                    setUserProfile(profileData);
                    setUserRole(profileData?.role || 'student'); // Set role from profile

                } catch (error) {
                    console.error('AuthContext: Error fetching/creating user profile:', error);
                    setUserProfile(null); // Clear profile on error
                    setUserRole(null); // Clear role on error
                } finally {
                    setIsFetchingProfile(false); // Mark profile fetch as complete
                    console.log("AuthContext: Profile fetch finished.");
                }
            } else {
                // User signed out - Clear profile and role
                setUserProfile(null);
                setUserRole(null);
                setIsFetchingProfile(false); // No profile fetch needed
                console.log("AuthContext: User signed out.");
            }

            // Mark that the initial onAuthStateChanged check has happened
            setInitialAuthCheckComplete(true);
            console.log("AuthContext: Initial auth check complete.");
        });

        return () => { console.log("AuthContext: Cleaning up listener."); unsubscribe(); };
    }, [auth, db]); // Dependency: auth instance


    // --- Effect: Determine final loading state ---
    // isLoading should be true until initial auth check is done AND profile fetch is done (if user exists)
    useEffect(() => {
        if (initialAuthCheckComplete) { // Wait for the listener to fire at least once
            if (currentUser && isFetchingProfile) {
                // User exists but profile is still loading
                setIsLoading(true);
                console.log("AuthContext: Setting final loading TRUE (auth done, profile pending).");
            } else {
                // Either user is null OR user exists and profile is loaded/failed
                setIsLoading(false);
                console.log("AuthContext: Setting final loading FALSE (auth done, profile done/not needed).");
            }
        } else {
            // Initial auth check hasn't even completed yet
            setIsLoading(true);
            console.log("AuthContext: Setting final loading TRUE (initial auth check pending).");
        }
    }, [initialAuthCheckComplete, currentUser, isFetchingProfile]); // Depend on these states


    // --- Context Value ---
    const contextValue: AuthContextType = {
        currentUser,
        userProfile,
        userRole,
        isLoading, // Provide the combined loading state
        // isProfileLoading: isFetchingProfile, // Expose if needed separately
    };

    // Log the final value being provided (optional, can be noisy)
    // console.log("Auth Context Final Value:", { currentUser: currentUser?.uid, userRole, isLoading });

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export type { UserProfile, AuthContextType }; // Re-export types