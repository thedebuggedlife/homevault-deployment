import { Card, CardContent, Typography, Box } from '@mui/material';
import ModulesList from '@/components/modules/ModulesList';
import { DockerContainer } from '@backend/types';

interface InstalledModulesCardProps {
    modules: string[];
    dockerContainers: DockerContainer[];
    expandedModule: string | null;
    onModuleClick: (moduleName: string) => void;
}

export function InstalledModulesCard({
    modules,
    dockerContainers,
    expandedModule,
    onModuleClick
}: InstalledModulesCardProps) {
    const hasModules = modules && modules.length > 0;

    return (
        <Card>
            <CardContent>
                <Typography variant="h5" gutterBottom>
                    Installed Modules
                </Typography>
                
                {hasModules ? (
                    <ModulesList
                        modules={modules}
                        dockerContainers={dockerContainers}
                        expandedModule={expandedModule}
                        onModuleClick={onModuleClick}
                    />
                ) : (
                    <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                            There are no modules installed
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}