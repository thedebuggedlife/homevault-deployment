import { ResticS3Repository } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";

export interface S3RepositoryProps {
    repository: ResticS3Repository
}

export default function S3Repository({ repository }: S3RepositoryProps) {
    return (
        <>
            <Grid container spacing={2}>
                <Grid size={6}>
                    <TextField
                        label="Endpoint"
                        value={repository.details.endpoint ?? ""}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Bucket"
                        value={repository.details.bucket ?? ""}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={12}>
                    <TextField
                        label="Path"
                        value={repository.details.path ?? "/"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Access Key"
                        value={repository.details.accessKeySet ? "••••••••" : "Not Set"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Secret Key"
                        value={repository.details.secretKeySet ? "••••••••" : "Not Set"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
            </Grid>
        </>
    );
}