import { useState } from 'react';
import {
    ListItem,
    ListItemButton,
    ListItemText,
    Checkbox,
    IconButton,
    Tooltip,
    ClickAwayListener
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

interface InstallModuleItemProps {
    name: string;
    description: string;
    selected: boolean;
    onToggle: (name: string) => void;
}

export default function InstallModuleItem({ name, description, selected, onToggle }: InstallModuleItemProps) {
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
                            sx={{ mr: 1 }}
                        >
                            <InfoIcon />
                        </IconButton>
                    </Tooltip>
                </ClickAwayListener>
            }
        >
            <ListItemButton 
                onClick={() => onToggle(name)}
                dense
            >
                <Checkbox
                    edge="start"
                    checked={selected}
                    tabIndex={-1}
                    disableRipple
                />
                <ListItemText primary={name} />
            </ListItemButton>
        </ListItem>
    );
}