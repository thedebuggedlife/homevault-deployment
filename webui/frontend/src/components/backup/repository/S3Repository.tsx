import SecretField from "@/components/SecretField";
import { S3CredentialDetails as S3Credentials, S3Details } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface S3RepositoryProps {
    details: S3Details;
    credentials?: S3Credentials;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: S3Details) => void;
    onCredentialsChange: (credentials: S3Credentials) => void;
    onValidation: (isValid: boolean) => void;
}

export default function S3Repository({
    details,
    credentials,
    allTouched,
    editMode = false,
    onDetailsChange,
    onCredentialsChange,
    onValidation,
}: S3RepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange =
        (field: "endpoint" | "bucket" | "region" | "path") => (event: React.ChangeEvent<HTMLInputElement>) => {
            const newDetails = _.cloneDeep(details);
            newDetails[field] = event.target.value;
            setTouched((prev) => ({ ...prev, [field]: true }));
            onDetailsChange(newDetails);
        };

    const handleCredentialsChange = (field: keyof S3Credentials) => (value: string) => {
        const newCredentials = _.cloneDeep(credentials ?? {});
        newCredentials[field] = value;
        onCredentialsChange(newCredentials);
    };

    const handleValidation = useCallback(() => {
        const isValid =
            !_.isEmpty(details.endpoint) &&
            (!_.isEmpty(details.region) || details.endpoint !== "s3.amazonaws.com") &&
            !_.isEmpty(details.bucket) &&
            !_.isEmpty(details.path) &&
            (!_.isEmpty(credentials?.accessKeyId) || details.accessKeySet) &&
            (!_.isEmpty(credentials?.secretAccessKey) || details.secretKeySet);
        onValidation(isValid);
        console.log(`isValid=${isValid}`)
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
                        label="Endpoint"
                        value={details.endpoint ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("endpoint") && _.isEmpty(details.endpoint)}
                        onChange={handleDetailsChange("endpoint")}
                    />
                </Grid>
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
                {details.endpoint !== "s3.amazonaws.com" && (
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
                )}
                {details.endpoint === "s3.amazonaws.com" && (
                    <>
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
                                label="Region"
                                value={details.region ?? ""}
                                fullWidth
                                disabled={!editMode}
                                variant="outlined"
                                error={isTouched("region") && _.isEmpty(details.region)}
                                onChange={handleDetailsChange("region")}
                                helperText={editMode ? "AWS region (e.g., us-east-1)" : ""}
                            />
                        </Grid>
                    </>
                )}
                <Grid size={{ xs: 12, lg: 6 }}>
                    <SecretField
                        label="Access Key"
                        value={credentials?.accessKeyId ?? ""}
                        isSet={details.accessKeySet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("accessKeyId")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <SecretField
                        label="Secret Key"
                        value={credentials?.secretAccessKey ?? ""}
                        isSet={details.secretKeySet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("secretAccessKey")}
                    />
                </Grid>
            </Grid>
        </>
    );
}
