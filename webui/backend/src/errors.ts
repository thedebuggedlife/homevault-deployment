export class ServiceError extends Error {
    constructor(message: string, public context?: any, public status = 500) {
        super(message);
    }
}

export function getErrorMessage(error: any) {
    return error?.message ?? "" + error;
}