export interface User {
  username: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
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