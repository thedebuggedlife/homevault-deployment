export type RepositoryType = 'local' | 's3' | 'b2' | 'rest' | 'sftp' | 'azure' | 'gs' | 'unknown';
  
export interface BackupStatus {
    initialized: boolean;
    repositoryType?: RepositoryType;
    repositoryLocation?: string;
    snapshotCount?: number;
    lastBackupTime?: string;
    totalSize?: number;
    totalUncompressedSize?: number;
    schedulingEnabled?: boolean;
    scheduleExpression?: string;
    retentionPolicy?: string;
  }
  
  export interface BackupSnapshot {
    id: string;
    time: string;
    hostname: string;
    tags: string[];
    paths: string[];
    size?: string;
    shortId?: string;
  }
  
  export interface BackupSchedule {
    enabled: boolean;
    cronExpression: string;
    retentionPolicy: string;
  }
  
  export interface BackupConfig {
    repository?: string;
    passwordSet?: boolean;
    s3?: {
        endpoint?: string;
        bucket?: string;
        path?: string;
        accessKeySet?: boolean;
        secretKeySet?: boolean;
    };
  }
  
  export interface RepositoryConfig {
    type: RepositoryType;
    config: Record<string, string>;
  }
  
  export interface BackupInitRequest {
    repositoryType: RepositoryType;
    config: Record<string, string>;
    password: string;
  }
  
  export interface BackupRunRequest {
    tag?: string;
    keepForever?: boolean;
  }