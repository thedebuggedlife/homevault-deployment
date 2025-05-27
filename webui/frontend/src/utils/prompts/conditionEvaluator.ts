export function evaluateCondition(condition: string, values: Record<string, string>): boolean {
    try {
        // Replace variable references with actual values
        let processedCondition = condition;
        
        // Find all variable references in the condition
        const variablePattern = /([A-Z_][A-Z0-9_]*)/g;
        const matches = condition.match(variablePattern);
        
        if (matches) {
            matches.forEach(varName => {
                if (varName in values) {
                    const value = values[varName];
                    
                    // Try to determine the type based on the condition context
                    if (condition.includes(`${varName}==true`) || condition.includes(`${varName}==false`) ||
                        condition.includes(`${varName}===true`) || condition.includes(`${varName}===false`)) {
                        // Boolean context
                        const boolValue = value.toLowerCase() === 'true';
                        processedCondition = processedCondition.replace(
                            new RegExp(`\\b${varName}\\b`, 'g'),
                            String(boolValue)
                        );
                    } else if (condition.includes(`${varName}>`) || condition.includes(`${varName}<`) ||
                               condition.includes(`${varName}>=`) || condition.includes(`${varName}<=`)) {
                        // Numeric context
                        const numValue = parseFloat(value) || 0;
                        processedCondition = processedCondition.replace(
                            new RegExp(`\\b${varName}\\b`, 'g'),
                            String(numValue)
                        );
                    } else {
                        // String context - wrap in quotes
                        processedCondition = processedCondition.replace(
                            new RegExp(`\\b${varName}\\b`, 'g'),
                            JSON.stringify(value)
                        );
                    }
                } else {
                    // Variable not set - replace with undefined
                    processedCondition = processedCondition.replace(
                        new RegExp(`\\b${varName}\\b`, 'g'),
                        'undefined'
                    );
                }
            });
        }
        
        // Create a safe evaluation function
        const func = new Function('return ' + processedCondition);
        return func();
    } catch (error) {
        console.error('Error evaluating condition:', condition, error);
        return false;
    }
}