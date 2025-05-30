export interface User {
  name: string;
}

export interface Backup {
  name: string;
  date: string;
  size: string;
}

export interface DeployModules {
  install: string[];
  remove: string[];
}

export interface InstallProgress {
  status: 'starting' | 'in-progress' | 'completed' | 'error';
  message: string;
  progress?: number;
} 