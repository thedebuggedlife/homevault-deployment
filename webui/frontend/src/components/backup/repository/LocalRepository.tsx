import { LocalDetails } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface LocalRepositoryProps {
    details: LocalDetails;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: LocalDetails) => void;
    onValidation: (isValid: boolean) => void;
}

export default function LocalRepository({
    details,
    allTouched,
    editMode = false,
    onDetailsChange,
    onValidation,
}: LocalRepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newDetails = _.cloneDeep(details);
        newDetails.path = event.target.value;
        setTouched((prev) => ({ ...prev, path: true }));
        onDetailsChange(newDetails);
    };

    const handleValidation = useCallback(() => {
        const isValid = !_.isEmpty(details.path);
        onValidation(isValid);
    }, [details, onValidation]);

    const isTouched = (field: string) => {
        return allTouched || !!touched[field];
    };

    useEffect(() => {
        handleValidation();
    }, [handleValidation]);

    useEffect(() => {
        setTouched({});
    }, [editMode]);

    return (
        <>
            <Grid container spacing={2}>
                <Grid size={12}>
                    <TextField
                        label="Path"
                        value={details.path ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("path") && _.isEmpty(details.path)}
                        onChange={handleDetailsChange}
                        helperText={editMode ? "Ensure the path exists and is accessible" : ""}
                    />
                </Grid>
            </Grid>
        </>
    );
}