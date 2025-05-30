import { useState } from 'react';
import {
    ListItem,
    ListItemButton,
    ListItemText,
    Checkbox,
    IconButton,
    Tooltip,
    ClickAwayListener,
    Box
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import CoreModuleChip from './CoreModuleChip';

interface InstallModuleItemProps {
    name: string;
    description: string;
    selected: boolean;
    onToggle: (name: string) => void;
    disabled?: boolean;
    showCoreChip?: boolean;
}

export default function InstallModuleItem({ 
    name, 
    description, 
    selected, 
    onToggle,
    disabled = false,
    showCoreChip = false
}: InstallModuleItemProps) {
    const [tooltipOpen, setTooltipOpen] = useState(false);

    const handleTooltipToggle = () => {
        setTooltipOpen(!tooltipOpen);
    };

    const handleTooltipClose = () => {
        setTooltipOpen(false);
    };

    return (
        <ListItem 
            disablePadding
            secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {showCoreChip && (
                        <CoreModuleChip tooltip="The base module is required and cannot be deselected" />
                    )}
                    <ClickAwayListener onClickAway={handleTooltipClose}>
                        <Tooltip
                            title={
                                <span dangerouslySetInnerHTML={{
                                    __html: description.replace(/\n/g, '<br/>')
                                }} />
                            }
                            open={tooltipOpen}
                            onClose={handleTooltipClose}
                            disableFocusListener
                            disableHoverListener
                            disableTouchListener
                            arrow
                            placement="left"
                        >
                            <IconButton
                                edge="end"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleTooltipToggle();
                                }}
                                onMouseEnter={() => setTooltipOpen(true)}
                                onMouseLeave={() => setTooltipOpen(false)}
                            >
                                <InfoIcon />
                            </IconButton>
                        </Tooltip>
                    </ClickAwayListener>
                </Box>
            }
        >
            <ListItemButton 
                onClick={() => !disabled && onToggle(name)}
                dense
                disabled={disabled}
            >
                <Checkbox
                    edge="start"
                    checked={selected}
                    tabIndex={-1}
                    disableRipple
                    disabled={disabled}
                />
                <ListItemText 
                    primary={name} 
                    primaryTypographyProps={{
                        sx: disabled ? { color: 'text.disabled' } : {}
                    }}
                />
            </ListItemButton>
        </ListItem>
    );
}