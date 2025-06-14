import { ResticRepository } from "./restic";

export interface BackupStatus {
    initialized: boolean;
    repository?: ResticRepository;
    snapshotCount?: number;
    lastBackupTime?: string;
    totalSize?: number;
    totalUncompressedSize?: number;
    schedule?: BackupSchedule;
    environment?: Record<string, string>;
}

export interface BackupSnapshot {
    id: string;
    time: string;
    hostname: string;
    tags: string[];
    totalSize?: number;
    shortId?: string;
}

export interface BackupSchedule {
    enabled: boolean;
    cronExpression?: string;
    retentionPolicy?: string;
}

export interface BackupInitRequest {
    repository: ResticRepository;
}

export interface BackupRunRequest {
    keepForever?: boolean;
}

export interface BackupRunResponse {
    activityId: string;
}

export interface DeleteSnapshotParams {
    snapshotId: string;
}