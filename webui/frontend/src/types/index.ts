export interface User {
  name: string;
}

export interface Module {
  moduleId: string;
  name: string;
  description: string;
  moduleVersion: string;
  isInstalled: boolean;
}

export interface Backup {
  name: string;
  date: string;
  size: string;
}

export interface InstallOptions {
  unattended: boolean;
  dryRun: boolean;
}

export interface InstallProgress {
  status: 'starting' | 'in-progress' | 'completed' | 'error';
  message: string;
  progress?: number;
} 