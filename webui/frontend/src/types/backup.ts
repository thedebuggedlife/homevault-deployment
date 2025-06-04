export interface BackupStatus {
    initialized: boolean;
    repositoryType?: string;
    repositoryLocation?: string;
    snapshotCount?: number;
    lastBackupTime?: string;
    totalSize?: string;
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
    b2?: {
        bucket?: string;
        path?: string;
        accountIdSet?: boolean;
        accountKeySet?: boolean;
    };
    rest?: {
        url?: string;
        usernameSet?: boolean;
        passwordSet?: boolean;
    };
  }
  
  export type RepositoryType = 'local' | 's3' | 'b2' | 'rest' | 'sftp' | 'azure' | 'gs';
  
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