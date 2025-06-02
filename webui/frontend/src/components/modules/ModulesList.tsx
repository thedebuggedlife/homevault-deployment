import { Box, Typography } from '@mui/material';
import { DockerContainer } from '@backend/types';
import { isContainerRelatedToModule, ModuleContainerInfo } from '@/utils/docker';
import ModuleListItem from './ModuleListItem';

interface ModulesListProps {
    modules: string[];
    dockerContainers: DockerContainer[] | undefined;
    expandedModule: string | null;
    onModuleClick: (moduleName: string) => void;
}

export default function ModulesList({
    modules,
    dockerContainers,
    expandedModule,
    onModuleClick
}: ModulesListProps) {
    const getModuleContainers = (moduleName: string): ModuleContainerInfo => {
        if (!dockerContainers) return { total: 0, running: 0, containers: [] };

        const containers = dockerContainers.filter(container =>
            isContainerRelatedToModule(container, moduleName)
        );

        return {
            total: containers.length,
            running: containers.filter(container => container.State === 'running').length,
            containers: containers
        };
    };

    const handleAccordionChange = (moduleName: string) => 
        (event: React.SyntheticEvent, isExpanded: boolean) => {
            onModuleClick(isExpanded ? moduleName : '');
        };

    if (modules.length === 0) {
        return (
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                    No modules installed
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {modules.map((module) => (
                <ModuleListItem
                    key={module}
                    moduleName={module}
                    containerInfo={getModuleContainers(module)}
                    isExpanded={expandedModule === module}
                    onChange={handleAccordionChange(module)}
                />
            ))}
        </Box>
    );
}