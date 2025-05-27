// List of valid IANA timezones (partial list for demonstration)
// In a real app, you might want to use a library like moment-timezone
const VALID_TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Amsterdam',
    'Europe/Stockholm',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Asia/Seoul',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Jerusalem',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Perth',
    'Australia/Brisbane',
    'Pacific/Auckland',
    'Pacific/Fiji',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Africa/Lagos',
    // Add more as needed
];

export function validateTimezone(value: string): boolean {
    // For a more complete implementation, you might want to use Intl.supportedValuesOf('timeZone')
    // if available in your target environment
    try {
        // Try to create a date with the timezone to validate it
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
    } catch {
        // Fallback to checking against known list
        return VALID_TIMEZONES.includes(value);
    }
}

export function validateRegex(value: string, pattern: string): boolean {
    try {
        const regex = new RegExp(pattern);
        return regex.test(value);
    } catch (error) {
        console.error('Invalid regex pattern:', pattern, error);
        return false;
    }
}