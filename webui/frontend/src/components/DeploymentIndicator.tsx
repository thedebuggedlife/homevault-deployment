import { Box, Typography } from '@mui/material';
import { useDeployment } from '@/hooks/useDeployment';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@mui/system';

// Create a pulsing glow animation
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
`;

export default function DeploymentIndicator() {
    const { isDeploying } = useDeployment();
    const navigate = useNavigate();

    if (!isDeploying) {
        return null;
    }

    return (
        <Box 
            sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.2, // Increased gap between orb and text
                ml: 2, // Add some left margin to separate from title
                cursor: 'pointer',
            }}
            onClick={() => navigate('/deployment')}
        >
            <Box
                sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: '#4caf50', // Green color
                    animation: `${pulse} 2s infinite`,
                    flexShrink: 0,
                }}
            />
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2, // Adjust line height for better alignment
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                Deployment in Progress
            </Typography>
        </Box>
    );
}