import SecretField from "@/components/SecretField";
import { SFTPCredentialDetails as SFTPCredentials, SFTPDetails } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface SFTPRepositoryProps {
    details: SFTPDetails;
    credentials?: SFTPCredentials;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: SFTPDetails) => void;
    onCredentialsChange: (credentials: SFTPCredentials) => void;
    onValidation: (isValid: boolean) => void;
}

export default function SFTPRepository({
    details,
    credentials,
    allTouched,
    editMode = false,
    onDetailsChange,
    onCredentialsChange,
    onValidation,
}: SFTPRepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange =
        (field: "host" | "username" | "path") => (event: React.ChangeEvent<HTMLInputElement>) => {
            const newDetails = _.cloneDeep(details);
            newDetails[field] = event.target.value;
            setTouched((prev) => ({ ...prev, [field]: true }));
            onDetailsChange(newDetails);
        };

    const handlePortChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newDetails = _.cloneDeep(details);
        newDetails.port = parseInt(event.target.value) || 22;
        setTouched((prev) => ({ ...prev, port: true }));
        onDetailsChange(newDetails);
    };

    const handleCredentialsChange = (field: keyof SFTPCredentials) => (value: string) => {
        const newCredentials = _.cloneDeep(credentials ?? {});
        newCredentials[field] = value;
        onCredentialsChange(newCredentials);
    };

    const handleValidation = useCallback(() => {
        const isValid =
            !_.isEmpty(details.host) &&
            !_.isEmpty(details.path) &&
            ((!_.isEmpty(credentials?.password) || details.passwordSet) ||
             (!_.isEmpty(credentials?.privateKey) || details.privateKeySet));
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
                <Grid size={{ xs: 12, lg: 8 }}>
                    <TextField
                        label="Host"
                        value={details.host ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("host") && _.isEmpty(details.host)}
                        onChange={handleDetailsChange("host")}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <TextField
                        label="Port"
                        value={details.port ?? 22}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        type="number"
                        onChange={handlePortChange}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <TextField
                        label="Username"
                        value={details.username ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        onChange={handleDetailsChange("username")}
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
                        label="Password"
                        value={credentials?.password ?? ""}
                        isSet={details.passwordSet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("password")}
                        helperText={editMode && !details.passwordSet && !details.privateKeySet ? "Either password or private key is required" : undefined}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <SecretField
                        label="Private Key"
                        value={credentials?.privateKey ?? ""}
                        isSet={details.privateKeySet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("privateKey")}
                        helperText={editMode && !details.passwordSet && !details.privateKeySet ? "Either password or private key is required" : undefined}
                    />
                </Grid>
            </Grid>
        </>
    );
}