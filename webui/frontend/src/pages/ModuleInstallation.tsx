import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Box
} from '@mui/material';
import { io, Socket } from 'socket.io-client';
import config from '@/config';
import { Module, InstallOptions, InstallProgress } from '@/types';

const ModuleInstallation: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installOptions, setInstallOptions] = useState<InstallOptions>({
    unattended: false,
    dryRun: false
  });
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    fetchModules();
    setupWebSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const setupWebSocket = () => {
    const newSocket = io(config.backendUrl);
    newSocket.on('install_progress', (progress: InstallProgress) => {
      setInstallProgress(progress);
    });
    setSocket(newSocket);
  };

  const fetchModules = async () => {
    try {
      const response = await fetch(`${config.backendUrl}/api/modules`);
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }
      const data = await response.json();
      setModules(data);
      setError('');
    } catch (err) {
      setError('Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = (module: Module) => {
    setSelectedModule(module);
    setInstallDialogOpen(true);
  };

  const handleInstallConfirm = async () => {
    if (!selectedModule) return;

    try {
      const response = await fetch(`${config.backendUrl}/api/modules/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleId: selectedModule.moduleId,
          options: installOptions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to install module');
      }

      setInstallDialogOpen(false);
      setSelectedModule(null);
      setInstallOptions({ unattended: false, dryRun: false });
      fetchModules();
    } catch (err) {
      setError('Failed to install module');
    }
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom>
        Module Installation
      </Typography>
      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid item xs={12} sm={6} md={4} key={module.moduleId}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {module.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Version: {module.moduleVersion}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  onClick={() => handleInstallClick(module)}
                  disabled={module.isInstalled}
                >
                  {module.isInstalled ? 'Installed' : 'Install'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={installDialogOpen} onClose={() => setInstallDialogOpen(false)}>
        <DialogTitle>Install Module</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to install {selectedModule?.name}?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={installOptions.unattended}
                onChange={(e) =>
                  setInstallOptions({ ...installOptions, unattended: e.target.checked })
                }
              />
            }
            label="Unattended Installation"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={installOptions.dryRun}
                onChange={(e) =>
                  setInstallOptions({ ...installOptions, dryRun: e.target.checked })
                }
              />
            }
            label="Dry Run"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstallDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInstallConfirm} color="primary">
            Install
          </Button>
        </DialogActions>
      </Dialog>

      {installProgress && (
        <Dialog open={!!installProgress} onClose={() => setInstallProgress(null)}>
          <DialogTitle>Installation Progress</DialogTitle>
          <DialogContent>
            <Typography>{installProgress.message}</Typography>
            {installProgress.progress !== undefined && (
              <CircularProgress
                variant="determinate"
                value={installProgress.progress}
                sx={{ mt: 2 }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </Container>
  );
};

export default ModuleInstallation; 