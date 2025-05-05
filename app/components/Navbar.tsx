"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, ComponentType } from "react";
import { auth } from "../firebase"; // Adjust path if necessary
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from "firebase/auth";
import {
  Menu,
  X,
  LogOut,
  LogIn,
  User as UserIcon,
  LayoutDashboard,
  Users,
  TrendingUp,
  Sparkles,
  Briefcase,
  FolderKanban,
  Library,
  GraduationCap,
  Cpu, // Icon for SNX AI (can be changed)
  LucideProps,
} from "lucide-react";

// --- Define Constants from Guidelines ---
const ACCENT_1 = "#0070F3"; // Primary Blue
const TEXT_BLACK = "#000000";
const BG_WHITE = "#FFFFFF";

// Helper to get initials from name
const getInitials = (name?: string | null): string => {
  if (!name) return "SN"; // Default initials
  const names = name.trim().split(" ");
  if (names.length === 1 && names[0].length > 0) {
    return names[0].substring(0, 2).toUpperCase();
  }
  // Safer access and join, fallback to SN
  const initials = names.slice(0, 2).map((n) => n?.[0] ?? "").join("");
  return initials.toUpperCase() || "SN"; // Fallback if empty
};

// Define interface for Nav Link items, including optional Icon
interface NavLinkItem {
  href: string;
  label: string;
  icon?: ComponentType<LucideProps>; // Lucide icons are React Components
}

const Navbar: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // --- Define icon margin constant ---
  const iconMargin = "mr-2"; // Space between icon and text

  // --- Navigation Links ---
  const leftNavLinks: NavLinkItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/community", label: "Community", icon: Users },
    { href: "/trends", label: "Trends", icon: TrendingUp }, // Assuming /trends page exists
    { href: "/nexai", label: "Nexai", icon: Sparkles },
  ];

  const rightNavLinks: NavLinkItem[] = [
    { href: "/snxai-feature", label: "SNX AI", icon: Cpu }, // Example link, adjust as needed
    { href: "/placements", label: "Placement", icon: Briefcase }, // Assuming /placements page exists
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/resources", label: "Resources", icon: Library },
    { href: "/learning", label: "Learning", icon: GraduationCap }, // Assuming /learning page exists
  ];

  // Combine links for the mobile menu
  const allNavLinks = [...leftNavLinks, ...rightNavLinks];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    });
    return () => unsubscribe();
  }, [isMobileMenuOpen]); // Re-run if menu state changes

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // Auth state change handles menu close
    } catch (error) {
      console.error("Error signing in with Google:", error);
      // TODO: Add user-facing error notification
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/"); // Redirect home
      // Auth state change handles menu close
    } catch (error) {
      console.error("Error signing out:", error);
       // TODO: Add user-facing error notification
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // --- Helper Function for Link Classes (Desktop & Mobile) ---
  const getLinkClasses = (href: string, isMobile: boolean = false): string => {
    // More robust check: handle trailing slashes and exact match preference
    const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href + '/')) || (href !== '/' && pathname === href);

    const baseClasses = `flex items-center font-medium transition-colors duration-200`;
    // Removed iconSize definition here as it's handled in renderNavLink

    // Desktop Styling
    const desktopBase = `${baseClasses} px-1 py-1 text-sm`;
    const desktopActive = `text-[${ACCENT_1}] border-b-2 border-[${ACCENT_1}] font-semibold`;
    const desktopInactive = `text-[${TEXT_BLACK}] border-b-2 border-transparent hover:text-[${ACCENT_1}]`;

    // Mobile Styling
    const mobileBase = `${baseClasses} w-full block px-3 py-3 text-base rounded-md`; // Increased padding for touch
    const mobileActive = `bg-gray-100 text-[${ACCENT_1}] font-semibold`;
    const mobileInactive = `text-[${TEXT_BLACK}] hover:bg-gray-100 hover:text-[${ACCENT_1}]`;

    return isMobile
      ? `${mobileBase} ${isActive ? mobileActive : mobileInactive}`
      : `${desktopBase} ${isActive ? desktopActive : desktopInactive}`;
  };


  // --- Render Link with Icon ---
  const renderNavLink = (link: NavLinkItem, isMobile: boolean) => (
    <Link
      key={isMobile ? `mobile-${link.href}` : link.href}
      href={link.href}
      onClick={isMobile ? closeMobileMenu : undefined} // Close only on mobile clicks
      className={getLinkClasses(link.href, isMobile)}
      aria-current={(pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href + '/'))) ? "page" : undefined} // Updated aria-current logic
    >
      {/* Use the iconMargin constant defined above */}
      {link.icon && <link.icon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} ${iconMargin}`} aria-hidden="true" />}
      {link.label}
    </Link>
  );

  return (
    <nav className={`font-inter fixed top-0 left-0 right-0 z-50 bg-${BG_WHITE}/95 backdrop-blur-sm text-[${TEXT_BLACK}] border-b border-gray-200`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">

          {/* --- Left Section --- */}
          <div className="flex items-center space-x-4 md:space-x-6">
            {/* Logo/Brand - Enhanced */}
            <Link href="/" className={`text-xl md:text-2xl font-bold text-[${TEXT_BLACK}] hover:text-opacity-80 transition-opacity`}>
              Skill Nexus
            </Link>

            {/* Desktop Left Links */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-5">
              {leftNavLinks.map(link => renderNavLink(link, false))}
            </div>
          </div>

          {/* --- Right Section --- */}
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Desktop Right Links */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-5">
              {rightNavLinks.map(link => renderNavLink(link, false))}
            </div>

            {/* --- Auth Controls (Common for Desktop/Mobile Toggle Button) --- */}
            <div className="flex items-center">
              {/* Desktop Auth - Loading State */}
              {loading && (
                <div className="hidden md:flex items-center space-x-3 ml-3"> {/* Added margin to separate from links */}
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-8 w-20 bg-gray-200 rounded-md animate-pulse"></div>
                </div>
              )}

              {/* Desktop Auth - Logged In/Out State */}
              {!loading && (
                <div className="hidden md:flex items-center space-x-3 ml-3"> {/* Added margin */}
                  {user ? (
                    <>
                      <Link
                        href="/dashboard" // Avatar links to dashboard now
                        className="group flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                        title="Go to Dashboard"
                      >
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.displayName || "User"}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-offset-1 ring-gray-300"
                            onError={(e) => {
                                // Try to hide the broken image to show fallback
                                const parent = e.currentTarget.parentElement;
                                e.currentTarget.style.display = 'none';
                                // If there's a fallback div sibling, ensure it's visible
                                const fallback = parent?.querySelector('.initials-avatar');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                            }}
                          />
                        ) : null} {/* Render img tag even if no URL initially */}
                        {/* Always render fallback, hide if image loads */}
                         <div className={`initials-avatar h-8 w-8 rounded-full bg-gray-400 text-white items-center justify-center text-xs font-bold ring-1 ring-offset-1 ring-gray-300 ${user.photoURL ? 'hidden' : 'flex'}`} // Initially hide if photoURL exists
                               style={{ display: user.photoURL ? undefined : 'flex' }} // Control display via style too for onError case
                         >
                            {getInitials(user.displayName)}
                          </div>
                      </Link>
                      <button
                        onClick={handleSignOut}
                        title="Sign Out"
                        className={`text-sm font-medium px-4 py-1.5 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition-colors duration-200`}
                      >
                        <span className="hidden md:inline">Sign Out</span>
                        <LogOut className="h-4 w-4 md:hidden" /> {/* Show icon on small screens */}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleSignIn}
                      title="Sign In"
                      className={`text-sm font-medium px-4 py-1.5 rounded-md bg-[${ACCENT_1}] text-white hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[${ACCENT_1}] transition-colors duration-200`}
                    >
                       <span className="hidden md:inline">Sign In</span>
                       <LogIn className="h-4 w-4 md:hidden" /> {/* Show icon on small screens */}
                    </button>
                  )}
                </div>
              )}

              {/* Mobile Menu Button */}
              <div className="flex items-center md:hidden ml-2"> {/* Adjusted margin */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  type="button"
                  className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[${ACCENT_1}] transition-colors duration-200"
                  aria-controls="mobile-menu"
                  aria-expanded={isMobileMenuOpen}
                  aria-label="Toggle main menu"
                >
                  <span className="sr-only">Open main menu</span>
                  {isMobileMenuOpen ? (
                    <X className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Menu className="block h-6 w-6" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div> {/* End Auth Controls Wrapper */}
          </div> {/* End Right Section */}
        </div> {/* End Relative Flex Container */}
      </div> {/* End Container */}

      {/* --- Mobile Menu Panel --- */}
      <div
        ref={mobileMenuRef}
        className={`md:hidden absolute top-16 inset-x-0 z-40 bg-${BG_WHITE} border-t border-gray-200 shadow-lg transition-all duration-300 ease-in-out overflow-hidden ${
          isMobileMenuOpen ? "max-h-screen opacity-100 visible" : "max-h-0 opacity-0 invisible"
        }`} // Use max-h for smooth height transition
        id="mobile-menu"
      >
         {/* Conditional rendering helps, but keeping structure for transition */}
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {/* Render ALL links in mobile menu */}
              {allNavLinks.map(link => renderNavLink(link, true))}
            </div>

            {/* Mobile Auth Section */}
            <div className="border-t border-gray-200 pt-4 pb-4">
              {loading ? (
                <div className="px-5 space-y-3">
                  <div className="h-10 w-full bg-gray-200 animate-pulse rounded-md"></div>
                  <div className="h-10 w-full bg-gray-200 animate-pulse rounded-md"></div>
                </div>
              ) : user ? (
                <div className="px-5 space-y-3">
                  {/* User Info */}
                  <div className="flex items-center space-x-3 mb-3">
                      {user.photoURL ? (
                          <img src={user.photoURL} alt="User" className="h-10 w-10 rounded-full object-cover ring-1 ring-offset-1 ring-gray-300"
                                onError={(e) => {
                                    const parent = e.currentTarget.parentElement;
                                    e.currentTarget.style.display = 'none';
                                    const fallback = parent?.querySelector('.initials-avatar-mobile');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }}
                          />
                      ) : null}
                       <div className={`initials-avatar-mobile h-10 w-10 rounded-full bg-gray-400 text-white items-center justify-center text-sm font-bold ring-1 ring-offset-1 ring-gray-300 ${user.photoURL ? 'hidden' : 'flex'}`}
                             style={{ display: user.photoURL ? undefined : 'flex' }}
                       >
                          {getInitials(user.displayName)}
                        </div>
                      <div>
                          <div className="text-base font-medium text-gray-800 leading-tight">
                          {user.displayName || 'User Profile'}
                          </div>
                      </div>
                  </div>
                  {/* Actions */}
                  <Link
                    href="/dashboard" // Explicit Dashboard link
                    onClick={closeMobileMenu}
                    className={`w-full flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[${ACCENT_1}] transition-colors duration-200`}
                  >
                    <LayoutDashboard className="h-5 w-5 mr-2 text-gray-500" />
                    My Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className={`w-full flex items-center justify-center px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-200`}
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Sign Out
                  </button>
                </div>
              ) : (
                 <div className="px-5">
                    <button
                    onClick={handleSignIn}
                    className={`w-full flex items-center justify-center px-4 py-2.5 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-[${ACCENT_1}] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[${ACCENT_1}] transition-colors duration-200`}
                    >
                    <LogIn className="h-5 w-5 mr-2" />
                    Sign In with Google
                    </button>
                </div>
              )}
            </div>
      </div> {/* End Mobile Menu Panel */}
    </nav>
  );
};

export default Navbar;
