import { DockerContainer } from '@backend/types';

export interface ModuleContainerInfo {
    total: number;
    running: number;
    containers: DockerContainer[];
}

export function isContainerRelatedToModule(container: DockerContainer, moduleName: string): boolean {
    return container.Labels.split(',').some(label => label.split('=')[0].trim() === `selfhost.module.${moduleName}`);
}

export function truncateImageWithSha256(image: string): string {
    const sha256Match = image.match(/@sha256:([a-f0-9]+)/);
    if (sha256Match) {
        const sha256Hash = sha256Match[1];
        const truncatedSha = sha256Hash.substring(0, 8);
        return image.replace(`@sha256:${sha256Hash}`, `@sha256:${truncatedSha}`);
    }
    return image;
}

export function cleanStatus(status: string): string {
    // Remove common suffixes in parentheses
    return status.replace(/\s*\([^)]*\)$/g, '').trim();
}

export function getStateColor(state: string) {
    switch (state.toLowerCase()) {
        case 'running':
            return 'success';
        case 'stopped':
        case 'exited':
            return 'error';
        case 'paused':
            return 'warning';
        default:
            return 'default';
    }
}