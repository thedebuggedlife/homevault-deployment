import { RETENTION_POLICY_EXAMPLES } from "@/utils/retentionPolicy";
import { Typography, Table, TableBody, TableRow, TableCell } from "@mui/material";


export default function RetentionPolicyExamples() {
    return (
        <>
            <Typography variant="subtitle1" color="text.primary" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                Common policies:
            </Typography>
            <Table
                sx={{
                    border: "none",
                    "& td": { border: "none", padding: "4px 0" },
                    tableLayout: "fixed",
                    width: "100%",
                }}
            >
                <TableBody>
                    {RETENTION_POLICY_EXAMPLES.map((example) => (
                        <TableRow key={example.policy}>
                            <TableCell sx={{ verticalAlign: "top", width: "120px", paddingRight: "16px" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                                    {example.policy}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                    {example.description}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}
