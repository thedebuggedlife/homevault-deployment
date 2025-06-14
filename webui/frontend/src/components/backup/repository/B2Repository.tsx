import SecretField from "@/components/SecretField";
import { B2CredentialDetails as B2Credentials, B2Details } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface B2RepositoryProps {
    details: B2Details;
    credentials?: B2Credentials;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: B2Details) => void;
    onCredentialsChange: (credentials: B2Credentials) => void;
    onValidation: (isValid: boolean) => void;
}

export default function B2Repository({
    details,
    credentials,
    allTouched,
    editMode = false,
    onDetailsChange,
    onCredentialsChange,
    onValidation,
}: B2RepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange =
        (field: "bucket" | "path") => (event: React.ChangeEvent<HTMLInputElement>) => {
            const newDetails = _.cloneDeep(details);
            newDetails[field] = event.target.value;
            setTouched((prev) => ({ ...prev, [field]: true }));
            onDetailsChange(newDetails);
        };

    const handleCredentialsChange = (field: keyof B2Credentials) => (value: string) => {
        const newCredentials = _.cloneDeep(credentials ?? {});
        newCredentials[field] = value;
        onCredentialsChange(newCredentials);
    };

    const handleValidation = useCallback(() => {
        const isValid =
            !_.isEmpty(details.bucket) &&
            !_.isEmpty(details.path) &&
            (!_.isEmpty(credentials?.accountId) || details.accountIdSet) &&
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
                    <SecretField
                        label="Account ID"
                        value={credentials?.accountId ?? ""}
                        isSet={details.accountIdSet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("accountId")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
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