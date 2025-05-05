// lib/themeUtils.ts

// Define the structure for theme properties relevant to backgrounds
export interface ProjectThemeStyles {
    backgroundClasses: string; // Tailwind classes for the background gradient/color
    // Add other shared style properties if needed later (e.g., accentBorderClass)
}

// Define the different theme styles
const themes: ProjectThemeStyles[] = [
    // Theme 1: Abstract Blue/Purple Wave Gradient
    { backgroundClasses: "bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600" },
    // Theme 2: Warm Gradient (Red/Orange/Yellow)
    { backgroundClasses: "bg-gradient-to-tr from-orange-500 via-red-500 to-pink-600" },
    // Theme 3: Soft Teal/Green Abstract
    { backgroundClasses: "bg-gradient-to-bl from-teal-500 via-green-500 to-emerald-600" },
    // Theme 4: Yellow/Lime/Green Abstract
    { backgroundClasses: "bg-gradient-to-r from-yellow-400 via-lime-500 to-green-500" },
     // Theme 5: Minimal White (Fallback or specific style)
    { backgroundClasses: "bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200" }, // Subtle gray gradient
];

// Function to get theme styles based on project ID
export function getProjectThemeStyles(projectId: string | undefined): ProjectThemeStyles {
    let hash = 0;
    const id = projectId || Date.now().toString(); // Use ID or fallback
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const themeIndex = Math.abs(hash) % themes.length;
    return themes[themeIndex];
}