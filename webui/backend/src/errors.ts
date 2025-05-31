export class ServiceError extends Error {
    constructor(message: string, public context?: any) {
        super(message);
    }
}

export function getErrorMessage(error: any) {
    return error?.message ?? error?.toString?.() ?? "" + error;
}