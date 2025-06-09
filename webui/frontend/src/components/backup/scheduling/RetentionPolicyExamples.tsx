import { Typography, Table, TableBody, TableRow, TableCell } from "@mui/material";

const POLICY_EXAMPLES = [
    {
        expression: "7D4W12M10Y",
        title: "Keep all daily snapshots for 7 days, all weekly for 4 weeks, all monthly for 12 months, all yearly for 10 years",
        subtitle: "Default policy, good for most use cases",
    },
    {
        expression: "24H7D",
        title: "Keep all hourly snapshots for the past day and all daily snapshots for the past weeks",
    },
    {
        expression: "7d",
        title: "Keep only the most recent daily snapshot for the last 7 days",
    },
    {
        expression: "7d4w12m",
        title: "Keep the most recent daily, weekly, and monthly snapshots",
    },
    {
        expression: "all",
        title: "Never delete any snapshots",
    },
];

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
                    {POLICY_EXAMPLES.map((example) => (
                        <TableRow>
                            <TableCell sx={{ verticalAlign: "top", width: "120px", paddingRight: "16px" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                                    {example.expression}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                    {example.title}
                                </Typography>
                                {example.subtitle && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        fontWeight="bold"
                                        sx={{ fontSize: "0.875em", fontStyle: "italic" }}
                                    >
                                        {example.subtitle}
                                    </Typography>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}
