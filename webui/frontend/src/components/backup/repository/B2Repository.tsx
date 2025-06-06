import { ResticB2Repository } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";

export interface B2RepositoryProps {
    repository: ResticB2Repository
}

export default function B2Repository({ repository }: B2RepositoryProps) {
    return (
        <>
            <Grid container spacing={2}>
                <Grid size={6}>
                    <TextField
                        label="Bucket"
                        value={repository?.details?.bucket ?? ""}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Path"
                        value={repository?.details.path ?? "/"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Account ID"
                        value={repository?.details?.accountIdSet ? "••••••••" : "Not Set"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Account Key"
                        value={repository?.details?.accountKeySet ? "••••••••" : "Not Set"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
            </Grid>
        </>
    );
}