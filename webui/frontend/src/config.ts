interface Config {
  backendUrl: string;
}

const config: Config = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
};

export default config; 