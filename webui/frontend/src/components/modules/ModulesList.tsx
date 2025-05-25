import { List, ListItem, ListItemText } from '@mui/material';
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

    if (modules.length === 0) {
        return (
            <List>
                <ListItem>
                    <ListItemText primary="No modules installed" />
                </ListItem>
            </List>
        );
    }

    return (
        <List>
            {modules.map((module, index) => (
                <ModuleListItem
                    key={module}
                    moduleName={module}
                    containerInfo={getModuleContainers(module)}
                    isExpanded={expandedModule === module}
                    isLast={index === modules.length - 1}
                    onClick={() => onModuleClick(module)}
                />
            ))}
        </List>
    );
}