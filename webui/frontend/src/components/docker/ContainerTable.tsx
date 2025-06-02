import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Chip
} from '@mui/material';
import { DockerContainer } from '@backend/types';
import StatusIcon from './StatusIcon';
import { cleanStatus, truncateImageWithSha256, getStateColor } from '@/utils/docker';

interface ContainerTableProps {
    containers: DockerContainer[];
}

export default function ContainerTable({ containers }: ContainerTableProps) {
    return (
        <TableContainer component={Paper} variant="outlined">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Container</TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Image</TableCell>
                        <TableCell>State</TableCell>
                        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Status</TableCell>
                        <TableCell align="center" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Health</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {containers.map((container) => (
                        <TableRow key={container.ID}>
                            <TableCell>
                                <Typography variant="body2" fontFamily="monospace">
                                    {container.Names}
                                </Typography>
                            </TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                <Typography variant="body2" color="text.secondary">
                                    {truncateImageWithSha256(container.Image)}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Chip
                                    label={container.State}
                                    color={getStateColor(container.State)}
                                    size="small"
                                    variant="filled"
                                />
                            </TableCell>
                            <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                                <Typography variant="body2" color="text.secondary">
                                    {cleanStatus(container.Status)}
                                </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                <StatusIcon status={container.Status} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}