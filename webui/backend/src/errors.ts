class ServiceError extends Error {
    constructor(message: string, public context?: any) {
        super(message);
    }
}