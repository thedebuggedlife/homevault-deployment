import { RepositoryType, ResticRepository } from "@backend/types/restic";

export function createEmptyRepository(type: RepositoryType): ResticRepository {
    const baseRepo = {
        location: "",
        passwordSet: false,
    };

    switch (type) {
        case "s3":
            return {
                ...baseRepo,
                repositoryType: "s3",
                location: "s3://",
                details: {
                    endpoint: "",
                    bucket: "",
                    path: "/",
                    region: "",
                    accessKeySet: false,
                    secretKeySet: false,
                },
            };
        case "b2":
            return {
                ...baseRepo,
                repositoryType: "b2",
                location: "b2://",
                details: {
                    bucket: "",
                    path: "/",
                    accountIdSet: false,
                    accountKeySet: false,
                },
            };
        case "rest":
            return {
                ...baseRepo,
                repositoryType: "rest",
                location: "rest://",
                details: {
                    url: "",
                    username: "",
                    passwordSet: false,
                },
            };
        case "azure":
            return {
                ...baseRepo,
                repositoryType: "azure",
                location: "azure://",
                details: {
                    accountName: "",
                    containerName: "",
                    path: "/",
                    accountKeySet: false,
                },
            };
        case "gs":
            return {
                ...baseRepo,
                repositoryType: "gs",
                location: "gs://",
                details: {
                    bucket: "",
                    path: "/",
                    projectId: "",
                    credentialsSet: false,
                },
            };
        case "sftp":
            return {
                ...baseRepo,
                repositoryType: "sftp",
                location: "sftp://",
                details: {
                    host: "",
                    port: 22,
                    username: "",
                    path: "/",
                    passwordSet: false,
                    privateKeySet: false,
                },
            };
        case "local":
        default:
            return {
                ...baseRepo,
                repositoryType: "local",
                location: "/backup",
                details: {
                    path: "/backup",
                },
            };
    }
}
