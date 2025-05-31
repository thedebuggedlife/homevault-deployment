interface Config {
  backendUrl: string;
}

const getDefaultBackendUrl = (): string => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001`;
  }
  // Fallback for SSR or build time
  return 'http://localhost:3001';
};

const config: Config = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || getDefaultBackendUrl()
};

export default config;