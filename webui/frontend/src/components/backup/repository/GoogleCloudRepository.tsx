import SecretField from "@/components/SecretField";
import { GoogleCloudCredentialDetails as GoogleCloudCredentials, GoogleCloudDetails } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface GoogleCloudRepositoryProps {
    details: GoogleCloudDetails;
    credentials?: GoogleCloudCredentials;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: GoogleCloudDetails) => void;
    onCredentialsChange: (credentials: GoogleCloudCredentials) => void;
    onValidation: (isValid: boolean) => void;
}

export default function GoogleCloudRepository({
    details,
    credentials,
    allTouched,
    editMode = false,
    onDetailsChange,
    onCredentialsChange,
    onValidation,
}: GoogleCloudRepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange =
        (field: "bucket" | "path" | "projectId") => (event: React.ChangeEvent<HTMLInputElement>) => {
            const newDetails = _.cloneDeep(details);
            newDetails[field] = event.target.value;
            setTouched((prev) => ({ ...prev, [field]: true }));
            onDetailsChange(newDetails);
        };

    const handleCredentialsChange = (field: keyof GoogleCloudCredentials) => (value: string) => {
        const newCredentials = _.cloneDeep(credentials ?? {});
        newCredentials[field] = value;
        onCredentialsChange(newCredentials);
    };

    const handleValidation = useCallback(() => {
        const isValid =
            !_.isEmpty(details.bucket) &&
            !_.isEmpty(details.path) &&
            (!_.isEmpty(credentials?.applicationCredentials) || details.credentialsSet);
        onValidation(isValid);
    }, [details, credentials, onValidation]);

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
                <Grid size={{ xs: 12, lg: 6 }}>
                    <TextField
                        label="Bucket"
                        value={details.bucket ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("bucket") && _.isEmpty(details.bucket)}
                        onChange={handleDetailsChange("bucket")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <TextField
                        label="Path"
                        value={details.path ?? "/"}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("path") && _.isEmpty(details.path)}
                        onChange={handleDetailsChange("path")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <TextField
                        label="Project ID"
                        value={details.projectId ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        onChange={handleDetailsChange("projectId")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <SecretField
                        label="Application Credentials"
                        value={credentials?.applicationCredentials ?? ""}
                        isSet={details.credentialsSet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("applicationCredentials")}
                        helperText={editMode && !details.credentialsSet ? "JSON key file content" : undefined}
                    />
                </Grid>
            </Grid>
        </>
    );
}