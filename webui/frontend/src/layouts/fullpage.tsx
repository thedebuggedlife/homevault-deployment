import { Box, Container, Typography } from "@mui/material";
import { ReactNode } from "react";

interface FullPageLayoutProps {
    headerContent?: ReactNode;
    title?: ReactNode;
    children: ReactNode;
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function FullPageLayout({ 
    headerContent, 
    title, 
    children, 
    maxWidth = 'md' 
}: FullPageLayoutProps) {
    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: 'background.default',
            py: 3
        }}>
            <Container maxWidth={maxWidth}>
                {headerContent && (
                    <Box mb={3}>
                        {headerContent}
                    </Box>
                )}

                {title && (
                    <Typography variant="h4" gutterBottom>
                        {title}
                    </Typography>
                )}

                {children}
            </Container>
        </Box>
    );
}