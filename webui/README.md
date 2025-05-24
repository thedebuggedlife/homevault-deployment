# HomeVault Web UI

A modern web interface for managing HomeVault installations and configurations.

## Features

- User authentication with system credentials
- Module installation and management
- System status monitoring
- Backup and restore functionality
- Real-time installation progress
- Responsive design for desktop and mobile

## Prerequisites

- Node.js 16.x or later
- npm 7.x or later
- HomeVault installation

## Project Structure

```
webui/
├── backend/           # Node.js Express backend
│   ├── src/
│   │   ├── app.js    # Main application file
│   │   └── services/ # Business logic
│   └── package.json
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── contexts/
│   └── package.json
└── dist/            # Distribution folder (created during build)
    ├── backend/     # Backend distribution files
    └── frontend/    # Frontend distribution files
```

## Setup

1. Install all dependencies:
   ```bash
   cd webui
   npm run install:all
   ```

2. Create a `.env` file in the backend directory:
   ```
   PORT=3001
   JWT_SECRET=your-secret-key
   FRONTEND_URL=http://localhost:3000
   ```

3. Create a `.env` file in the frontend directory:
   ```
   VITE_BACKEND_URL=http://localhost:3001
   ```

## Development

Start both frontend and backend in development mode:
```bash
cd webui
npm run dev
```

Or start them separately:
```bash
# Start backend
npm run start:backend

# Start frontend
npm run start:frontend
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001 (or your custom backend URL)

## Building for Production

1. Build the distribution package:
   ```bash
   cd webui
   npm run build
   ```

   This will create a `dist` folder with the following structure:
   ```
   dist/
   ├── backend/     # Backend distribution files
   │   ├── app.js
   │   ├── services/
   │   └── package.json
   └── frontend/    # Frontend distribution files
       ├── static/
       ├── index.html
       └── ...
   ```

2. To run the production build:
   ```bash
   cd webui/dist/backend
   npm install --production
   npm start
   ```

   The frontend files in `dist/frontend` should be served by your web server.

## Security

- Authentication is performed using system credentials
- Only users with sudo privileges can access the interface
- JWT tokens are used for session management
- All sensitive operations require authentication
- API endpoints are protected with authentication middleware

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the same license as HomeVault. 