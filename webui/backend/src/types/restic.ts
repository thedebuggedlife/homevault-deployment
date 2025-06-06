export interface S3CredentialDetails {
    accessKeyId?: string;
    secretAccessKey?: string;
}

export interface B2CredentialDetails {
    accountId?: string;
    accountKey?: string;
}

export interface AzureCredentialDetails {
    accountName?: string;
    accountKey?: string;
}

export interface GoogleCloudCredentialDetails {
    projectId?: string;
    applicationCredentials?: string;
}

export interface SFTPCredentialDetails {
    username?: string;
    password?: string;
    privateKey?: string;
}

export interface RESTCredentialDetails {
    username?: string;
    password?: string;
}

export interface LocalCredentialDetails {
    // Local repositories don't need additional credentials
}

export interface RepositoryCredentials {
    resticPassword: string;
    details:
        | S3CredentialDetails
        | B2CredentialDetails
        | AzureCredentialDetails
        | GoogleCloudCredentialDetails
        | SFTPCredentialDetails
        | RESTCredentialDetails
        | LocalCredentialDetails;
}

export interface S3Details {
    subType: "aws" | "other";
    endpoint?: string;
    bucket: string;
    path: string;
    region?: string;
    accessKeySet: boolean;
    secretKeySet: boolean;
}

export interface B2Details {
    bucket: string;
    path: string;
    accountIdSet: boolean;
    accountKeySet: boolean;
}

export interface AzureDetails {
    accountName?: string;
    containerName: string;
    path: string;
    accountKeySet: boolean;
}

export interface GoogleCloudDetails {
    bucket: string;
    path: string;
    projectId?: string;
    credentialsSet: boolean;
}

export interface SFTPDetails {
    host: string;
    port?: number;
    username?: string;
    path: string;
    passwordSet: boolean;
    privateKeySet: boolean;
}

export interface RESTDetails {
    url: string;
    username?: string;
    passwordSet: boolean;
}

export interface LocalDetails {
    path: string;
}

export interface ResticS3Repository {
    repositoryType: "s3";
    details: S3Details;
    credentials?: RepositoryCredentials & { details: S3CredentialDetails };
}

export interface ResticB2Repository {
    repositoryType: "b2";
    details: B2Details;
    credentials?: RepositoryCredentials & { details: B2CredentialDetails };
}

export interface ResticAzureRepository {
    repositoryType: "azure";
    details: AzureDetails;
    credentials?: RepositoryCredentials & { details: AzureCredentialDetails };
}

export interface ResticGoogleCloudRepository {
    repositoryType: "gs";
    details: GoogleCloudDetails;
    credentials?: RepositoryCredentials & { details: GoogleCloudCredentialDetails };
}

export interface ResticSFTPRepository {
    repositoryType: "sftp";
    details: SFTPDetails;
    credentials?: RepositoryCredentials & { details: SFTPCredentialDetails };
}

export interface ResticRESTRepository {
    repositoryType: "rest";
    details: RESTDetails;
    credentials?: RepositoryCredentials & { details: RESTCredentialDetails };
}

export interface ResticLocalRepository {
    repositoryType: "local";
    details: LocalDetails;
    credentials?: RepositoryCredentials & { details: LocalCredentialDetails };
}

export class MissingCredentialsError extends Error {
    constructor(public missingFields: string[]) {
        super(`Missing required credentials: ${missingFields.join(", ")}`);
        this.name = "MissingCredentialsError";
    }
}

// Update the ResticRepository type to be a discriminated union
export type ResticRepository = (
    | ResticS3Repository
    | ResticB2Repository
    | ResticAzureRepository
    | ResticGoogleCloudRepository
    | ResticSFTPRepository
    | ResticRESTRepository
    | ResticLocalRepository) & {
        location: string
        passwordSet: boolean
    };

/**
 * Parse environment variables to determine repository type and configuration
 * @param env Environment variables as key-value pairs
 * @returns Restic repository configuration
 */
export function parseRepositoryEnvironment(env: Record<string, string>): ResticRepository | undefined {
    const repository = env.RESTIC_REPOSITORY;

    if (!repository) {
        return;
    }

    let parsed: Omit<ResticRepository, "location" | "passwordSet">;

    // Check for S3 repository
    if (repository.startsWith("s3:")) {
        parsed = parseS3Repository(repository, env);
    }

    // Check for B2 repository
    else if (repository.startsWith("b2:")) {
        parsed = parseB2Repository(repository, env);
    }

    // Check for Azure repository
    else if (repository.startsWith("azure:")) {
        parsed = parseAzureRepository(repository, env);
    }

    // Check for Google Cloud Storage repository
    else if (repository.startsWith("gs:")) {
        parsed = parseGoogleCloudRepository(repository, env);
    }

    // Check for SFTP repository
    else if (repository.startsWith("sftp:")) {
        parsed = parseSFTPRepository(repository, env);
    }

    // Check for REST repository
    else if (repository.startsWith("rest:")) {
        parsed = parseRESTRepository(repository, env);
    }

    // Default to local repository
    else {
        parsed = {
            repositoryType: "local",
            details: {
                path: repository,
            } as LocalDetails,
        }
    };

    return {
        ...parsed,
        location: repository,
        passwordSet: !!env["RESTIC_PASSWORD"],
    } as ResticRepository;
}

function parseS3Repository(repository: string, env: Record<string, string>): ResticS3Repository {
    // Remove 's3:' prefix
    const s3Path = repository.substring(3);

    // Parse URL components
    let endpoint: string | undefined;
    let bucket: string;
    let path: string = "/";
    let subType: "aws" | "other" = "other";
    let region: string | undefined;

    // Check if it's a URL format (with or without scheme)
    if (s3Path.includes("://") || s3Path.match(/^[^/]+\.[^/]+\//)) {
        // Remove scheme if present
        const urlWithoutScheme = s3Path.replace(/^https?:\/\//, "");

        // Extract host and path
        const firstSlash = urlWithoutScheme.indexOf("/");
        if (firstSlash > -1) {
            endpoint = urlWithoutScheme.substring(0, firstSlash);
            const remainingPath = urlWithoutScheme.substring(firstSlash + 1);

            // Extract bucket and path from remaining path
            const bucketEnd = remainingPath.indexOf("/");
            if (bucketEnd > -1) {
                bucket = remainingPath.substring(0, bucketEnd);
                path = remainingPath.substring(bucketEnd);
            } else {
                bucket = remainingPath;
            }
        } else {
            // No path after host, invalid format
            endpoint = urlWithoutScheme;
            bucket = "";
        }

        // Check if it's AWS S3
        if (endpoint && endpoint.includes("amazonaws.com")) {
            subType = "aws";

            // Try to extract region from endpoint
            // Patterns: s3.{region}.amazonaws.com or s3-{region}.amazonaws.com
            const regionMatch = endpoint.match(/s3[.-]([a-z0-9-]+)\.amazonaws\.com/);
            if (regionMatch && regionMatch[1] !== "external") {
                region = regionMatch[1];
            } else if (endpoint === "s3.amazonaws.com") {
                // Legacy endpoint, check for region in env
                region = env.AWS_DEFAULT_REGION;
            }
        }
    } else {
        // Legacy format: bucket/path
        const firstSlash = s3Path.indexOf("/");
        if (firstSlash > -1) {
            bucket = s3Path.substring(0, firstSlash);
            path = s3Path.substring(firstSlash);
        } else {
            bucket = s3Path;
        }

        // For legacy format, assume AWS if AWS credentials are present
        if (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY) {
            subType = "aws";
            region = env.AWS_DEFAULT_REGION;
        }
    }

    // Normalize path
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (path.endsWith("/") && path.length > 1) {
        path = path.slice(0, -1);
    }

    const details: S3Details = {
        subType,
        endpoint,
        bucket,
        path,
        region,
        accessKeySet: !!env.AWS_ACCESS_KEY_ID,
        secretKeySet: !!env.AWS_SECRET_ACCESS_KEY,
    };

    return {
        repositoryType: "s3",
        details,
    };
}

function parseB2Repository(repository: string, env: Record<string, string>): ResticB2Repository {
    // Remove 'b2:' prefix
    const b2Path = repository.substring(3);

    // B2 format is typically b2:bucketName/path
    const firstSlash = b2Path.indexOf("/");
    let bucket: string;
    let path: string = "/";

    if (firstSlash > -1) {
        bucket = b2Path.substring(0, firstSlash);
        path = b2Path.substring(firstSlash);
    } else {
        bucket = b2Path;
    }

    // Normalize path
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (path.endsWith("/") && path.length > 1) {
        path = path.slice(0, -1);
    }

    const details: B2Details = {
        bucket,
        path,
        accountIdSet: !!env.B2_ACCOUNT_ID,
        accountKeySet: !!env.B2_ACCOUNT_KEY,
    };

    return {
        repositoryType: "b2",
        details,
    };
}

function parseAzureRepository(repository: string, env: Record<string, string>): ResticAzureRepository {
    // Remove 'azure:' prefix
    const azurePath = repository.substring(6);

    // Azure format is typically azure:containerName:/path
    const parts = azurePath.split(":");
    let containerName: string;
    let path: string = "/";

    if (parts.length >= 1) {
        containerName = parts[0];
        if (parts.length >= 2) {
            path = parts[1];
        }
    } else {
        containerName = azurePath;
    }

    // Normalize path
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (path.endsWith("/") && path.length > 1) {
        path = path.slice(0, -1);
    }

    const details: AzureDetails = {
        accountName: env.AZURE_ACCOUNT_NAME,
        containerName,
        path,
        accountKeySet: !!env.AZURE_ACCOUNT_KEY,
    };

    return {
        repositoryType: "azure",
        details,
    };
}

function parseGoogleCloudRepository(repository: string, env: Record<string, string>): ResticGoogleCloudRepository {
    // Remove 'gs:' prefix
    const gsPath = repository.substring(3);

    // GCS format is typically gs://bucket/path or gs:bucket/path
    const cleanPath = gsPath.replace(/^\/\//, ""); // Remove leading // if present

    const firstSlash = cleanPath.indexOf("/");
    let bucket: string;
    let path: string = "/";

    if (firstSlash > -1) {
        bucket = cleanPath.substring(0, firstSlash);
        path = cleanPath.substring(firstSlash);
    } else {
        bucket = cleanPath;
    }

    // Normalize path
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (path.endsWith("/") && path.length > 1) {
        path = path.slice(0, -1);
    }

    const details: GoogleCloudDetails = {
        bucket,
        path,
        projectId: env.GOOGLE_PROJECT_ID,
        credentialsSet: !!env.GOOGLE_APPLICATION_CREDENTIALS,
    };

    return {
        repositoryType: "gs",
        details,
    };
}

function parseSFTPRepository(repository: string, env: Record<string, string>): ResticSFTPRepository {
    // Remove 'sftp:' prefix
    const sftpUrl = repository.substring(5);

    // Parse SFTP URL: [user@]host[:port]/path
    let username: string | undefined;
    let host: string;
    let port: number | undefined;
    let path: string = "/";

    // Extract user if present
    const atIndex = sftpUrl.indexOf("@");
    let hostPart: string;

    if (atIndex > -1) {
        username = sftpUrl.substring(0, atIndex);
        hostPart = sftpUrl.substring(atIndex + 1);
    } else {
        hostPart = sftpUrl;
        username = env.SFTP_USERNAME;
    }

    // Extract host, port, and path
    const firstSlash = hostPart.indexOf("/");
    let hostAndPort: string;

    if (firstSlash > -1) {
        hostAndPort = hostPart.substring(0, firstSlash);
        path = hostPart.substring(firstSlash);
    } else {
        hostAndPort = hostPart;
    }

    // Extract port if present
    const colonIndex = hostAndPort.lastIndexOf(":");
    if (colonIndex > -1) {
        const portStr = hostAndPort.substring(colonIndex + 1);
        const portNum = parseInt(portStr, 10);
        if (!isNaN(portNum)) {
            host = hostAndPort.substring(0, colonIndex);
            port = portNum;
        } else {
            host = hostAndPort;
        }
    } else {
        host = hostAndPort;
    }

    // Normalize path
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (path.endsWith("/") && path.length > 1) {
        path = path.slice(0, -1);
    }

    const details: SFTPDetails = {
        host,
        port,
        username,
        path,
        passwordSet: !!env.SFTP_PASSWORD,
        privateKeySet: !!env.SFTP_PRIVATE_KEY || !!env.SFTP_KEY_FILE,
    };

    return {
        repositoryType: "sftp",
        details,
    };
}

function parseRESTRepository(repository: string, env: Record<string, string>): ResticRESTRepository {
    // Remove 'rest:' prefix
    let restUrl = repository.substring(5);

    // Ensure URL has a scheme
    if (!restUrl.includes("://")) {
        restUrl = "https://" + restUrl;
    }

    // Try to parse URL to extract username if present
    let username: string | undefined;
    try {
        const url = new URL(restUrl);
        if (url.username) {
            username = url.username;
            // Remove credentials from URL for storage
            url.username = "";
            url.password = "";
            restUrl = url.toString();
        }
    } catch {
        // Invalid URL, store as-is
    }

    // Check for username in environment if not in URL
    if (!username) {
        username = env.REST_USERNAME || env.RESTIC_REST_USERNAME;
    }

    const details: RESTDetails = {
        url: restUrl,
        username,
        passwordSet: !!env.REST_PASSWORD || !!env.RESTIC_REST_PASSWORD,
    };

    return {
        repositoryType: "rest",
        details,
    };
}

/**
 * Generate environment variables from a parsed repository configuration
 * @param repository Parsed repository with optional credentials
 * @param existingEnv Existing environment variables to use for missing credentials
 * @returns New environment variables map
 * @throws MissingCredentialsError if required credentials are not available
 */
export function generateRepositoryEnvironment(
    repository: ResticRepository,
    existingEnv: Record<string, string> = {}
): Record<string, string> {
    const env: Record<string, string> = {};
    const missingFields: string[] = [];

    // Always require RESTIC_PASSWORD
    if (repository.credentials?.resticPassword) {
        env.RESTIC_PASSWORD = repository.credentials.resticPassword;
    } else if (existingEnv.RESTIC_PASSWORD) {
        env.RESTIC_PASSWORD = existingEnv.RESTIC_PASSWORD;
    } else {
        missingFields.push("RESTIC_PASSWORD");
    }

    // Generate RESTIC_REPOSITORY based on type
    switch (repository.repositoryType) {
        case "s3":
            env.RESTIC_REPOSITORY = generateS3RepositoryUrl(repository.details);
            generateS3Environment(repository, existingEnv, env, missingFields);
            break;
        case "b2":
            env.RESTIC_REPOSITORY = generateB2RepositoryUrl(repository.details);
            generateB2Environment(repository, existingEnv, env, missingFields);
            break;
        case "azure":
            env.RESTIC_REPOSITORY = generateAzureRepositoryUrl(repository.details);
            generateAzureEnvironment(repository, existingEnv, env, missingFields);
            break;
        case "gs":
            env.RESTIC_REPOSITORY = generateGoogleCloudRepositoryUrl(repository.details);
            generateGoogleCloudEnvironment(repository, existingEnv, env, missingFields);
            break;
        case "sftp":
            env.RESTIC_REPOSITORY = generateSFTPRepositoryUrl(repository.details);
            generateSFTPEnvironment(repository, existingEnv, env, missingFields);
            break;
        case "rest":
            env.RESTIC_REPOSITORY = generateRESTRepositoryUrl(repository.details);
            generateRESTEnvironment(repository, existingEnv, env, missingFields);
            break;
        case "local":
            env.RESTIC_REPOSITORY = repository.details.path;
            // Local repositories don't need additional credentials
            break;
    }

    if (missingFields.length > 0) {
        throw new MissingCredentialsError(missingFields);
    }

    return env;
}

// Helper functions to generate repository URLs
function generateS3RepositoryUrl(details: S3Details): string {
    if (details.endpoint) {
        // Full URL format
        const protocol = details.endpoint.includes("://") ? "" : "https://";
        return `s3:${protocol}${details.endpoint}/${details.bucket}${details.path}`;
    } else {
        // Legacy format
        return `s3:${details.bucket}${details.path}`;
    }
}

function generateB2RepositoryUrl(details: B2Details): string {
    return `b2:${details.bucket}${details.path}`;
}

function generateAzureRepositoryUrl(details: AzureDetails): string {
    return `azure:${details.containerName}:${details.path}`;
}

function generateGoogleCloudRepositoryUrl(details: GoogleCloudDetails): string {
    return `gs:${details.bucket}${details.path}`;
}

function generateSFTPRepositoryUrl(details: SFTPDetails): string {
    let url = "sftp:";
    if (details.username) {
        url += `${details.username}@`;
    }
    url += details.host;
    if (details.port && details.port !== 22) {
        url += `:${details.port}`;
    }
    url += details.path;
    return url;
}

function generateRESTRepositoryUrl(details: RESTDetails): string {
    return `rest:${details.url}`;
}

// Helper functions to generate environment variables for each repository type
function generateS3Environment(
    repository: ResticS3Repository,
    existingEnv: Record<string, string>,
    env: Record<string, string>,
    missingFields: string[]
): void {
    const creds = repository.credentials?.details as S3CredentialDetails | undefined;

    // AWS_ACCESS_KEY_ID
    if (creds?.accessKeyId) {
        env.AWS_ACCESS_KEY_ID = creds.accessKeyId;
    } else if (existingEnv.AWS_ACCESS_KEY_ID) {
        env.AWS_ACCESS_KEY_ID = existingEnv.AWS_ACCESS_KEY_ID;
    } else if (repository.details.subType === "aws") {
        missingFields.push("AWS_ACCESS_KEY_ID");
    }

    // AWS_SECRET_ACCESS_KEY
    if (creds?.secretAccessKey) {
        env.AWS_SECRET_ACCESS_KEY = creds.secretAccessKey;
    } else if (existingEnv.AWS_SECRET_ACCESS_KEY) {
        env.AWS_SECRET_ACCESS_KEY = existingEnv.AWS_SECRET_ACCESS_KEY;
    } else if (repository.details.subType === "aws") {
        missingFields.push("AWS_SECRET_ACCESS_KEY");
    }

    // AWS_DEFAULT_REGION (optional but recommended for AWS)
    if (repository.details.region) {
        env.AWS_DEFAULT_REGION = repository.details.region;
    } else if (existingEnv.AWS_DEFAULT_REGION) {
        env.AWS_DEFAULT_REGION = existingEnv.AWS_DEFAULT_REGION;
    }
}

function generateB2Environment(
    repository: ResticB2Repository,
    existingEnv: Record<string, string>,
    env: Record<string, string>,
    missingFields: string[]
): void {
    const creds = repository.credentials?.details as B2CredentialDetails | undefined;

    // B2_ACCOUNT_ID
    if (creds?.accountId) {
        env.B2_ACCOUNT_ID = creds.accountId;
    } else if (existingEnv.B2_ACCOUNT_ID) {
        env.B2_ACCOUNT_ID = existingEnv.B2_ACCOUNT_ID;
    } else {
        missingFields.push("B2_ACCOUNT_ID");
    }

    // B2_ACCOUNT_KEY
    if (creds?.accountKey) {
        env.B2_ACCOUNT_KEY = creds.accountKey;
    } else if (existingEnv.B2_ACCOUNT_KEY) {
        env.B2_ACCOUNT_KEY = existingEnv.B2_ACCOUNT_KEY;
    } else {
        missingFields.push("B2_ACCOUNT_KEY");
    }
}

function generateAzureEnvironment(
    repository: ResticAzureRepository,
    existingEnv: Record<string, string>,
    env: Record<string, string>,
    missingFields: string[]
): void {
    const creds = repository.credentials?.details as AzureCredentialDetails | undefined;

    // AZURE_ACCOUNT_NAME
    if (creds?.accountName) {
        env.AZURE_ACCOUNT_NAME = creds.accountName;
    } else if (repository.details.accountName) {
        env.AZURE_ACCOUNT_NAME = repository.details.accountName;
    } else if (existingEnv.AZURE_ACCOUNT_NAME) {
        env.AZURE_ACCOUNT_NAME = existingEnv.AZURE_ACCOUNT_NAME;
    } else {
        missingFields.push("AZURE_ACCOUNT_NAME");
    }

    // AZURE_ACCOUNT_KEY
    if (creds?.accountKey) {
        env.AZURE_ACCOUNT_KEY = creds.accountKey;
    } else if (existingEnv.AZURE_ACCOUNT_KEY) {
        env.AZURE_ACCOUNT_KEY = existingEnv.AZURE_ACCOUNT_KEY;
    } else {
        missingFields.push("AZURE_ACCOUNT_KEY");
    }
}

function generateGoogleCloudEnvironment(
    repository: ResticGoogleCloudRepository,
    existingEnv: Record<string, string>,
    env: Record<string, string>,
    missingFields: string[]
): void {
    const creds = repository.credentials?.details as GoogleCloudCredentialDetails | undefined;

    // GOOGLE_PROJECT_ID (optional)
    if (creds?.projectId) {
        env.GOOGLE_PROJECT_ID = creds.projectId;
    } else if (repository.details.projectId) {
        env.GOOGLE_PROJECT_ID = repository.details.projectId;
    } else if (existingEnv.GOOGLE_PROJECT_ID) {
        env.GOOGLE_PROJECT_ID = existingEnv.GOOGLE_PROJECT_ID;
    }

    // GOOGLE_APPLICATION_CREDENTIALS
    if (creds?.applicationCredentials) {
        env.GOOGLE_APPLICATION_CREDENTIALS = creds.applicationCredentials;
    } else if (existingEnv.GOOGLE_APPLICATION_CREDENTIALS) {
        env.GOOGLE_APPLICATION_CREDENTIALS = existingEnv.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
        missingFields.push("GOOGLE_APPLICATION_CREDENTIALS");
    }
}

function generateSFTPEnvironment(
    repository: ResticSFTPRepository,
    existingEnv: Record<string, string>,
    env: Record<string, string>,
    missingFields: string[]
): void {
    const creds = repository.credentials?.details as SFTPCredentialDetails | undefined;

    // SFTP_USERNAME (might be in URL)
    if (creds?.username) {
        env.SFTP_USERNAME = creds.username;
    } else if (repository.details.username) {
        env.SFTP_USERNAME = repository.details.username;
    } else if (existingEnv.SFTP_USERNAME) {
        env.SFTP_USERNAME = existingEnv.SFTP_USERNAME;
    }

    // Need either password or private key
    const hasPassword = creds?.password || existingEnv.SFTP_PASSWORD;
    const hasPrivateKey = creds?.privateKey || existingEnv.SFTP_PRIVATE_KEY || existingEnv.SFTP_KEY_FILE;

    if (creds?.password) {
        env.SFTP_PASSWORD = creds.password;
    } else if (existingEnv.SFTP_PASSWORD) {
        env.SFTP_PASSWORD = existingEnv.SFTP_PASSWORD;
    }

    if (creds?.privateKey) {
        env.SFTP_PRIVATE_KEY = creds.privateKey;
    } else if (existingEnv.SFTP_PRIVATE_KEY) {
        env.SFTP_PRIVATE_KEY = existingEnv.SFTP_PRIVATE_KEY;
    } else if (existingEnv.SFTP_KEY_FILE) {
        env.SFTP_KEY_FILE = existingEnv.SFTP_KEY_FILE;
    }

    if (!hasPassword && !hasPrivateKey) {
        missingFields.push("SFTP_PASSWORD or SFTP_PRIVATE_KEY");
    }
}

function generateRESTEnvironment(
    repository: ResticRESTRepository,
    existingEnv: Record<string, string>,
    env: Record<string, string>,
    missingFields: string[]
): void {
    const creds = repository.credentials?.details as RESTCredentialDetails | undefined;

    // REST_USERNAME (optional, might be in URL)
    if (creds?.username) {
        env.REST_USERNAME = creds.username;
    } else if (repository.details.username) {
        env.REST_USERNAME = repository.details.username;
    } else if (existingEnv.REST_USERNAME || existingEnv.RESTIC_REST_USERNAME) {
        env.REST_USERNAME = existingEnv.REST_USERNAME || existingEnv.RESTIC_REST_USERNAME;
    }

    // REST_PASSWORD (usually required if username is present)
    if (creds?.password) {
        env.REST_PASSWORD = creds.password;
    } else if (existingEnv.REST_PASSWORD || existingEnv.RESTIC_REST_PASSWORD) {
        env.REST_PASSWORD = existingEnv.REST_PASSWORD || existingEnv.RESTIC_REST_PASSWORD;
    } else if (env.REST_USERNAME || repository.details.username) {
        missingFields.push("REST_PASSWORD");
    }
}
