// app/layout.tsx
import type { Metadata } from "next";
// --- Correctly import the font objects from geist ---
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import "./globals.css"; // Your global styles

// Import your Navbar component
import Navbar from "./components/Navbar";

// --- Import the AuthProvider ---
import { AuthProvider } from "@/context/AuthContext"; // Ensure this path is correct

// --- Assign the imported font objects directly ---
const geistSans = GeistSans;
const geistMono = GeistMono;


export const metadata: Metadata = {
  title: "Skill Nexus", // Or your project title
  description: "Community and learning platform", // Or your description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply font variables to the html tag
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* Apply base theme classes */}
      <body className={`font-sans antialiased bg-background text-foreground`}>
        {/* Wrap components needing auth context */}
        <AuthProvider>
          {/* Navbar is fixed */}
          <Navbar />
          {/* Main content area, padded at the top */}
          <main className="pt-16 min-h-screen">
            {children} {/* This is where your page components will render */}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}