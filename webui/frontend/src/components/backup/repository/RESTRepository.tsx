import { ResticRESTRepository } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";

export interface RESTRepositoryProps {
    repository: ResticRESTRepository
}

export default function RESTRepository({ repository }: RESTRepositoryProps) {
    return (
        <>
            <Grid container spacing={2}>
                <Grid size={12}>
                    <TextField
                        label="REST Server URL"
                        value={repository.details.url ?? ""}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Username"
                        value={repository.details.username ?? "Not Set"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
                <Grid size={6}>
                    <TextField
                        label="Password"
                        value={repository.details.passwordSet ? "••••••••" : "Not Set"}
                        fullWidth
                        disabled
                        variant="outlined"
                    />
                </Grid>
            </Grid>
        </>
    );
}