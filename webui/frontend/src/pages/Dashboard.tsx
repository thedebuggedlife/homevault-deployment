import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import axios from 'axios';
import config from '@/config';
import { SystemStatus } from '@backend/types';

const Dashboard: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get<SystemStatus>(`${config.backendUrl}/api/status`);
      setSystemStatus(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
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
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              System Overview
            </Typography>
            <Typography>
              Installed Modules: {systemStatus?.installedModules?.length}
            </Typography>
            <Typography>
              Docker Containers: {systemStatus?.docker?.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Resource Usage
            </Typography>
            {/* <Typography>
              CPU Usage: {systemStatus?.resources?.cpu ?? 0}%
            </Typography>
            <Typography>
              Memory Usage: {systemStatus?.resources?.memory ?? 0}%
            </Typography>
            <Typography>
              Disk Usage: {systemStatus?.resources?.disk ?? 0}%
            </Typography> */}
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Active Services
            </Typography>
            {/* {systemStatus?.services?.map((service) => (
              <Typography key={service.name}>
                {service.name}: {service.status}
              </Typography>
            ))} */}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 