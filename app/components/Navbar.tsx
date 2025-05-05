// src/components/Navbar.tsx
"use client"; // This component needs client-side interactivity

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
// Make sure this path is correct for your Firebase app instance
import app from "@/app/firebase"; // Corrected import path


// --- Import the useAuth hook ---
// Adjust path if necessary based on where your AuthContext.tsx is located
import { useAuth } from '@/context/AuthContext';

// Import Icons from lucide-react
import { Brain, Sparkles, Bell, User, LogIn, LogOut, Search } from 'lucide-react'; // Added Search icon


const Navbar: React.FC = () => {
  // --- Consume Auth Context ---
  const { user, loading } = useAuth(); // Using 'user' and 'loading' from the AuthContext example we built earlier

  const pathname = usePathname();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();

  // --- Effect to handle Redirect Result ---
  // Keep this if you are using signInWithRedirect for mobile
  useEffect(() => {
     if (!loading) { // Check after auth state is determined
         console.log("Navbar Effect: Checking for redirect result...");
         getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    console.log("✅ Redirect Sign-In Success:", result.user.uid);
                     // Optional: Redirect user after successful redirect sign-in if needed
                     // router.push('/dashboard');
                } else {
                     console.log("ℹ️ No pending redirect result found.");
                }
            })
            .catch((error) => {
                console.error("❌ Google Sign-In Error:", error.code, error.message);
                 // Handle errors like 'auth/popup-closed-by-user' or others
            });
     } else {
         console.log("Navbar Effect: Auth state loading, skipping redirect check.");
     }
  }, [auth, loading]); // Depend on auth and loading state


  // Sign-in Handler
  const handleSignIn = async () => {
    try {
      // Optional: Force account selection every time
      provider.setCustomParameters({
        prompt: "select_account",
      });

      if (window.innerWidth > 768) {
        console.log("🖥️ Trying popup sign-in...");
        await signInWithPopup(auth, provider);
        console.log("✅ Popup Sign-In flow completed.");
      } else {
        console.log("🌐 Redirecting for sign-in...");
        await signInWithRedirect(auth, provider);
      }
    } catch (error: any) {
      console.error("❌ Google Sign-In Error:", error.message, error);
       if (error.code !== 'auth/popup-closed-by-user') { // Ignore if user just closed popup
           // Optionally show a user-friendly message
           // alert(`Sign-in failed: ${error.message}`);
       }
    }
  };

  // Sign-out Handler
  const handleSignOut = async () => {
    try {
      console.log("Attempting sign out...");
      await signOut(auth);
      console.log("✅ User signed out successfully.");
      // AuthContext listener will update state, triggering UI change
      // Optional: Redirect to home or login page after logout
      // router.push('/');
    } catch (error: any) {
      console.error("❌ Sign-out Error:", error.code, error.message, error);
       // Optionally show a user-friendly message
       // alert(`Sign-out failed: ${error.message}`);
    }
  };

   // --- Placeholder for CorAI Action ---
  const handleCorAIClick = () => {
      // TODO: Implement CorAI modal or navigation later
      console.log("CorAI button clicked! Implement AI interaction here.");
      alert("CorAI is coming soon!"); // Temporary feedback
  };
  // ----------------------------------

  // Tailwind Classes for link styling
  const linkBaseClasses = "text-gray-700 hover:text-blue-600 transition-colors duration-150 pb-1 relative";
  const linkActiveClasses = "font-semibold border-b-2 border-green-500 text-green-600"; // Green accent for active


  // Main Navigation Links - Visible when logged in, placed in the center
  const mainNavLinks = user ? [
    { href: '/techverse', label: 'TechVerse' },
    { href: '/soulspace', label: 'SoulSpace' },
    { href: '/socialbeat', label: 'Social Pulse' },
    { href: '/timetrek', label: 'TimeTrek' },
    { href: '/echowall', label: 'Echo Wall' },
  ] : [];

  // Right-side Links/Actions - Visible when logged in, placed on the right
   const rightSideLinks = user ? [
       { href: '/recommendations', label: 'Recommendations', icon: Search }, // Recommendations link with icon
       // CorAI button is handled separately below
   ] : [];


  return (
    // Navbar container - using Tailwind classes for fixed position, background, padding, flex layout, etc.
    <nav className="fixed top-0 left-0 w-full bg-white text-gray-900 flex items-center justify-between px-4 md:px-6 lg:px-8 py-3 z-50 shadow-sm border-b border-gray-200 h-16">

      {/* Left Side: Logo Group */}
      <div className="flex items-center gap-2 min-w-max"> {/* min-w-max prevents logo from shrinking */}
        <Brain size={24} className="text-blue-600" /> {/* Blue icon for logo */}
        <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-700 transition-colors duration-150">
          The Cortex
        </Link>
      </div>

      {/* Center: Main Navigation Links (Only visible when logged in) */}
      {/* Using flex-grow to push the right content away, and mx-auto to attempt centering */}
      {/* This combination with justify-between might not perfectly center, but spaces effectively */}
      {!loading && user && (
          <div className="flex items-center gap-6 flex-grow justify-center mx-auto hidden md:flex"> {/* Added hidden/md:flex for responsiveness */}
              {mainNavLinks.map((link) => {
                  // Check if the current path starts with the link's href for active state
                  // Special handling for the root path '/' if needed elsewhere, but not in this list
                  const isActive = pathname.startsWith(link.href);

                  return (
                      <Link
                          key={link.href}
                          href={link.href}
                          // Conditionally apply active classes
                          className={`${linkBaseClasses} ${isActive ? linkActiveClasses : ''}`}
                      >
                          {link.label}
                      </Link>
                  );
              })}
          </div>
      )}


      {/* Right Side: CorAI, Recommendations, Notifications, User/Auth */}
      <div className="flex items-center gap-6 min-w-max"> {/* min-w-max prevents this section from shrinking */}

        {/* Logged-in Right-Side Actions */}
         {!loading && user ? (
           <>
            {/* CorAI Trigger Button */}
             <button onClick={handleCorAIClick} className="flex items-center gap-1 text-gray-700 hover:text-green-600 transition-colors duration-150 cursor-pointer p-1">
                 <Sparkles size={20} className="text-green-500" /> {/* Green icon for AI */}
                 <span className="font-semibold">CorAI</span> {/* Text label */}
             </button>

            {/* Recommendations Link */}
             {rightSideLinks.map((link) => {
                 const isActive = pathname.startsWith(link.href);
                 const Icon = link.icon; // Get the icon component

                 return (
                      <Link
                          key={link.href}
                          href={link.href}
                           // Conditionally apply active classes
                          className={`${linkBaseClasses} ${isActive ? linkActiveClasses : ''} flex items-center gap-1 p-1`} // Added flex/gap for icon+text
                      >
                          {Icon && <Icon size={20} />} {/* Render icon if exists */}
                          <span>{link.label}</span> {/* Text label */}
                      </Link>
                 );
             })}

            {/* Notification Icon - Placeholder Button */}
            <button className="text-gray-700 hover:text-blue-600 transition-colors duration-150 cursor-pointer p-1">
                <Bell size={20} /> {/* Bell icon */}
            </button>

            {/* Vertical Divider */}
            <div className="h-5 w-px bg-gray-300" aria-hidden="true"></div>


            {/* User Avatar */}
            {/* Clicking avatar could eventually open a dropdown or go to profile */}
            {/* For now, maybe make it go to profile page? Or keep it as a placeholder? Let's make it go to /profile */}
            <Link href="/profile">
                 <img
                   src={user.photoURL || "/default-avatar.png"} // Fallback avatar
                   alt={user.displayName || user.email || "User Avatar"} // Show name or email on hover
                   className="w-8 h-8 rounded-full border border-gray-300 object-cover hover:scale-110 transition-transform duration-200" // Tailwind for avatar styling and hover
                   title={user.displayName || user.email || "User"} // Show name or email on hover
                 />
            </Link>

            {/* Sign Out Button (could be in avatar dropdown too) */}
             {/* Keeping it separate for clarity based on your previous code structure */}
             <button
                 onClick={handleSignOut}
                 className="bg-white text-gray-800 border border-gray-300 font-medium py-1.5 px-3 text-sm rounded hover:border-red-500 hover:text-red-600 transition duration-200" // Adjusted padding
             >
                 Sign Out
             </button>

           </>
        ) : ( // If user is NOT logged in
          // Show Loading state or Sign In button
           loading ? (
              <div className="h-9 w-24 bg-gray-200 rounded animate-pulse"></div> // Tailwind loading animation
           ) : (
              <button
                  onClick={handleSignIn}
                  className="bg-blue-600 text-white font-medium py-1.5 px-4 rounded text-sm hover:bg-blue-700 transition duration-200 flex items-center gap-2" // Blue button for sign-in
              >
                  <LogIn size={18} /> Sign In
              </button>
           )
        )}
      </div>
    </nav>
  );
};

export default Navbar;