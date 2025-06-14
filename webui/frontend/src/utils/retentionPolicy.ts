export interface RetentionPolicyPart {
    count: number;
    unit: string;
    keepAll: boolean;
}

/**
 * Parse a retention policy string into its component parts
 * @param policy The retention policy string (e.g., "7d4W12m")
 * @returns Array of parsed policy parts
 */
export function parseRetentionPolicy(policy: string): RetentionPolicyPart[] {
    if (policy.toLowerCase() === 'all') {
        return [];
    }

    const parts: RetentionPolicyPart[] = [];
    const matches = policy.match(/(\d+)([hdwmyHDWMY])/g);
    
    if (!matches) {
        return [];
    }

    matches.forEach(match => {
        const parsed = match.match(/(\d+)([hdwmyHDWMY])/);
        if (parsed) {
            const count = parseInt(parsed[1]);
            const unit = parsed[2];
            parts.push({
                count,
                unit: unit.toLowerCase(),
                keepAll: unit === unit.toUpperCase()
            });
        }
    });

    return parts;
}

/**
 * Validate a retention policy string
 * @param policy The retention policy string to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateRetentionPolicy(policy: string): string | undefined {
    if (!policy.trim()) {
        return "Retention policy is required";
    }
    
    if (policy.toLowerCase() === "all") {
        return undefined; // "all" is valid
    }
    
    // Check format: should match pattern like 7d, 4W, 12m, 5Y
    const pattern = /^(\d+[hdwmyHDWMY])+$/;
    if (!pattern.test(policy)) {
        return "Invalid format. Use combinations of #h, #H, #d, #D, #w, #W, #m, #M, #y, #Y (e.g., 7D4W12M10Y) or 'all'";
    }
    
    // Parse to ensure it's valid
    const parts = parseRetentionPolicy(policy);
    if (parts.length === 0) {
        return "Invalid retention policy format";
    }
    
    return undefined;
}

/**
 * Get the unit name for display
 * @param unit Single character unit (h, d, w, m, y)
 * @param plural Whether to use plural form
 * @returns Human-readable unit name
 */
function getUnitName(unit: string, plural: boolean): string {
    const unitNames: Record<string, [string, string]> = {
        'h': ['hour', 'hours'],
        'd': ['day', 'days'],
        'w': ['week', 'weeks'],
        'm': ['month', 'months'],
        'y': ['year', 'years']
    };
    
    const names = unitNames[unit.toLowerCase()];
    if (!names) return unit;
    
    return plural ? names[1] : names[0];
}

/**
 * Get the snapshot type name
 * @param unit Single character unit (h, d, w, m, y)
 * @returns Snapshot type name (e.g., "hourly", "daily")
 */
function getSnapshotType(unit: string): string {
    const types: Record<string, string> = {
        'h': 'hourly',
        'd': 'daily',
        'w': 'weekly',
        'm': 'monthly',
        'y': 'yearly'
    };
    
    return types[unit.toLowerCase()] || unit;
}

/**
 * Format a retention policy into a human-readable description
 * @param policy The retention policy string
 * @returns Human-readable description
 */
export function formatRetentionPolicy(policy: string): string {
    if (policy.toLowerCase() === 'all') {
        return "Keep all snapshots indefinitely";
    }

    const parts = parseRetentionPolicy(policy);
    if (parts.length === 0) {
        return "Invalid retention policy";
    }

    const descriptions = parts.map(part => {
        const unitName = getUnitName(part.unit, part.count !== 1);
        const snapshotType = getSnapshotType(part.unit);
        
        if (part.keepAll) {
            return `all ${snapshotType} snapshots for the last ${part.count} ${unitName}`;
        } else {
            return `the most recent ${snapshotType} snapshot for the last ${part.count} ${unitName}`;
        }
    });

    if (descriptions.length === 1) {
        return `Keep ${descriptions[0]}`;
    } else if (descriptions.length === 2) {
        return `Keep ${descriptions[0]} and ${descriptions[1]}`;
    } else {
        const last = descriptions.pop();
        return `Keep ${descriptions.join(', ')}, and ${last}`;
    }
}

/**
 * Common retention policy examples with descriptions
 */
export const RETENTION_POLICY_EXAMPLES = [
    { policy: "7D4W12M10Y", description: "Keep all daily snapshots for 7 days, all weekly for 4 weeks, all monthly for 12 months, and all yearly for 10 years" },
    { policy: "7d", description: "Keep only the most recent daily snapshot for the last 7 days" },
    { policy: "24H7D", description: "Keep all hourly snapshots for the past day and all daily snapshots for the past week" },
    { policy: "30d", description: "Keep only the most recent daily snapshot for the last 30 days" },
    { policy: "7d4w12m", description: "Keep the most recent daily snapshot for 7 days, weekly for 4 weeks, and monthly for 12 months" },
    { policy: "all", description: "Never delete any snapshots" }
];