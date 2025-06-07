import SecretField from "@/components/SecretField";
import { AzureCredentialDetails as AzureCredentials, AzureDetails } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface AzureRepositoryProps {
    details: AzureDetails;
    credentials?: AzureCredentials;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: AzureDetails) => void;
    onCredentialsChange: (credentials: AzureCredentials) => void;
    onValidation: (isValid: boolean) => void;
}

export default function AzureRepository({
    details,
    credentials,
    allTouched,
    editMode = false,
    onDetailsChange,
    onCredentialsChange,
    onValidation,
}: AzureRepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange =
        (field: "accountName" | "containerName" | "path") => (event: React.ChangeEvent<HTMLInputElement>) => {
            const newDetails = _.cloneDeep(details);
            newDetails[field] = event.target.value;
            setTouched((prev) => ({ ...prev, [field]: true }));
            onDetailsChange(newDetails);
        };

    const handleCredentialsChange = (field: keyof AzureCredentials) => (value: string) => {
        const newCredentials = _.cloneDeep(credentials ?? {});
        newCredentials[field] = value;
        onCredentialsChange(newCredentials);
    };

    const handleValidation = useCallback(() => {
        const isValid =
            !_.isEmpty(details.accountName) &&
            !_.isEmpty(details.containerName) &&
            !_.isEmpty(details.path) &&
            (!_.isEmpty(credentials?.accountKey) || details.accountKeySet);
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
                        label="Account Name"
                        value={details.accountName ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("accountName") && _.isEmpty(details.accountName)}
                        onChange={handleDetailsChange("accountName")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <TextField
                        label="Container Name"
                        value={details.containerName ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("containerName") && _.isEmpty(details.containerName)}
                        onChange={handleDetailsChange("containerName")}
                    />
                </Grid>
                <Grid size={12}>
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
                <Grid size={12}>
                    <SecretField
                        label="Account Key"
                        value={credentials?.accountKey ?? ""}
                        isSet={details.accountKeySet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("accountKey")}
                    />
                </Grid>
            </Grid>
        </>
    );
}