import { Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { themes, ThemeName, getTheme } from '@/utils/xterm';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
    output: string[];
    defaultTheme?: ThemeName;
    showThemeSelector?: boolean;
}

export default function Terminal({ 
    output, 
    defaultTheme = 'dracula',
    showThemeSelector = false 
}: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const lastOutputLengthRef = useRef<number>(0);
    const [currentTheme, setCurrentTheme] = useState<ThemeName>(defaultTheme);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Create terminal instance
        const xterm = new XTerm({
            theme: getTheme(currentTheme),
            fontFamily: 'monospace',
            fontSize: 14,
            lineHeight: 1.2,
            convertEol: true,
            scrollback: 10000,
            cursorStyle: 'block',
            cursorBlink: false,
            disableStdin: true,
        });

        // Add fit addon to handle resizing
        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        
        // Add web links addon for clickable links
        const webLinksAddon = new WebLinksAddon();
        xterm.loadAddon(webLinksAddon);

        // Open terminal in the DOM element
        xterm.open(terminalRef.current);
        
        // Initial fit
        fitAddon.fit();

        // Store references
        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Handle window resize
        const handleResize = () => {
            fitAddon.fit();
        };
        window.addEventListener('resize', handleResize);

        // Write initial output if any
        if (output.length > 0) {
            output.forEach((line) => {
                xterm.writeln(line);
            });
            lastOutputLengthRef.current = output.length;
        }

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            xterm.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTheme]); // Re-create terminal when theme changes

    // Handle theme changes
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.options.theme = getTheme(currentTheme);
        }
    }, [currentTheme]);

    // Handle output updates
    useEffect(() => {
        if (!xtermRef.current) return;

        // Only write new lines that haven't been written yet
        if (output.length > lastOutputLengthRef.current) {
            const newLines = output.slice(lastOutputLengthRef.current);
            newLines.forEach((line) => {
                xtermRef.current!.writeln(line);
            });
            lastOutputLengthRef.current = output.length;
            
            // Auto-scroll to bottom
            xtermRef.current.scrollToBottom();
        } else if (output.length < lastOutputLengthRef.current) {
            // If output array was reset/cleared, clear the terminal and rewrite all
            xtermRef.current.clear();
            output.forEach((line) => {
                xtermRef.current!.writeln(line);
            });
            lastOutputLengthRef.current = output.length;
        }
    }, [output]);

    // Handle container resize
    useEffect(() => {
        if (!fitAddonRef.current || !terminalRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
            fitAddonRef.current?.fit();
        });

        resizeObserver.observe(terminalRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <Box>
            {showThemeSelector && (
                <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
                    <InputLabel id="theme-select-label">Terminal Theme</InputLabel>
                    <Select
                        labelId="theme-select-label"
                        value={currentTheme}
                        label="Terminal Theme"
                        onChange={(e) => setCurrentTheme(e.target.value as ThemeName)}
                    >
                        {Object.keys(themes).map((themeName) => (
                            <MenuItem key={themeName} value={themeName}>
                                {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
            <Box
                sx={{
                    backgroundColor: themes[currentTheme].background,
                    borderRadius: 2,
                    padding: 1,
                    height: '400px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    ref={terminalRef}
                    style={{
                        height: '100%',
                        width: '100%',
                    }}
                />
            </Box>
        </Box>
    );
}