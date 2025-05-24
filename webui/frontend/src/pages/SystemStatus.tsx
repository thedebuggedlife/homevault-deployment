import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Alert,
  Box
} from '@mui/material';
import axios from 'axios';
import config from '@/config';
import { SystemStatus as SystemStatusType, Service } from '@/types';

const SystemStatus: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await axios.get(`${config.backendUrl}/api/status`);
      setSystemStatus(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceAction = async (service: Service, action: 'start' | 'stop') => {
    try {
      const response = await fetch(`${config.backendUrl}/api/services/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceName: service.name }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} service`);
      }

      fetchSystemStatus();
    } catch (err) {
      setError(`Failed to ${action} service`);
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
        System Status
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              System Overview
            </Typography>
            <Typography>
              Docker Status: {systemStatus?.docker ? 'Running' : 'Stopped'}
            </Typography>
            <Typography>
              Installed Modules: {systemStatus?.installedModules.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Resource Usage
            </Typography>
            <Typography>
              CPU Usage: {systemStatus?.resources?.cpu ?? 0}%
            </Typography>
            <Typography>
              Memory Usage: {systemStatus?.resources?.memory ?? 0}%
            </Typography>
            <Typography>
              Disk Usage: {systemStatus?.resources?.disk ?? 0}%
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Services Status
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Service Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {systemStatus?.services?.map((service) => (
                    <TableRow key={service.name}>
                      <TableCell>{service.name}</TableCell>
                      <TableCell>{service.status}</TableCell>
                      <TableCell>
                        {service.status === 'running' ? (
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={() => handleServiceAction(service, 'stop')}
                          >
                            Stop
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() => handleServiceAction(service, 'start')}
                          >
                            Start
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SystemStatus; 