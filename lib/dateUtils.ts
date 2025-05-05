// lib/dateUtils.ts (or lib/utils.ts)
import { format, formatDistanceToNowStrict, formatRelative, isToday, isYesterday } from 'date-fns';

/**
 * Formats a timestamp into a user-friendly relative or absolute string.
 * Examples: "5 minutes ago", "Yesterday at 2:30 PM", "Apr 10", "Apr 10, 2023"
 */
export function formatTimestamp(dateInput: string | Date | undefined | null): string {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        const now = new Date();

        // Use formatRelative for intelligent formatting based on proximity to 'now'
        // It handles "Today", "Yesterday", "Last Wednesday", "MM/dd/yyyy" etc.
        // customize formatRelative further if needed: https://date-fns.org/v2.30.0/docs/formatRelative
        return formatRelative(date, now);

    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return 'Invalid Date';
    }
}


/**
 * Formats a timestamp into a full date and time string.
 * Example: "Apr 11, 2024, 10:35 AM"
 */
export function formatFullTimestamp(dateInput: string | Date | undefined | null): string {
     if (!dateInput) return '';
      try {
          const date = new Date(dateInput);
          return format(date, 'MMM d, yyyy, h:mm a'); // e.g. Apr 11, 2024, 10:35 AM
      } catch (e) { return 'Invalid Date'; }
}

// You can keep your simpler formatDate if preferred for specific cases
export function formatSimpleDate(dateString: string | undefined): string {
    if (!dateString) return 'Unknown date';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch { return 'Invalid date'; }
}