import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@mui/system';
import { useSession } from '@/contexts/SessionContext';
import { useCallback, useState } from 'react';
import ProgressDialog from './ProgressDialog';

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
    const { activity } = useSession();
    const [ showProgress, setShowProgress ] = useState(false);
    const [ activityId, setActivityId ] = useState<string>();
    const navigate = useNavigate();

    const handleClick = () => {
        switch (activity?.type) {
            case "deployment": 
                navigate('/deployment', { state: { activity }});
                break;
            default: 
                setShowProgress(true);
                setActivityId(activity.id);
                break;
        }
    };

    const handleCloseProgress = useCallback(() => {
        setShowProgress(false);
        setActivityId(null);
    }, [setShowProgress, setActivityId]);

    if (!activity && !showProgress) {
        return null;
    }

    return (
        <>
            <Box 
                sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.2, // Increased gap between orb and text
                    ml: 2, // Add some left margin to separate from title
                    cursor: 'pointer',
                }}
                onClick={handleClick}
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
                    Operation in progress
                </Typography>
            </Box>
            <ProgressDialog open={showProgress} activityId={activityId} onClose={handleCloseProgress} />
        </>
    );
}