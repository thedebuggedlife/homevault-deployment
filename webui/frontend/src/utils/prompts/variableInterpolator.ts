export function interpolateVariables(text: string, values: Record<string, string>): string {
    if (!text) return text;
    
    // Replace {variable} patterns with their values
    return text.replace(/\{([^}]+)\}/g, (match, varName) => {
        if (varName in values) {
            return values[varName];
        }
        // Keep the original placeholder if value not found
        return match;
    });
}

export function hasUnresolvedVariables(text: string, values: Record<string, string>): boolean {
    if (!text) return false;
    
    const matches = text.match(/\{([^}]+)\}/g);
    if (!matches) return false;
    
    return matches.some(match => {
        const varName = match.slice(1, -1);
        return !(varName in values);
    });
}