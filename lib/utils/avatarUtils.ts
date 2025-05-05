// lib/utils/avatarUtils.ts

// Helper function to get initials from name or email
export const getInitials = (name?: string | null, email?: string | null): string => {
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
export const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || url.trim() === '') return false; // A URL must be present and not just whitespace
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch (_) {
        return false;
    }
};