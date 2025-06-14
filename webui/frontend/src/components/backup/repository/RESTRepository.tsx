import SecretField from "@/components/SecretField";
import { RESTCredentialDetails as RESTCredentials, RESTDetails } from "@backend/types/restic";
import { Grid, TextField } from "@mui/material";
import _, { Dictionary } from "lodash";
import { useCallback, useEffect, useState } from "react";

export interface RESTRepositoryProps {
    details: RESTDetails;
    credentials?: RESTCredentials;
    editMode?: boolean;
    allTouched?: boolean;
    onDetailsChange: (details: RESTDetails) => void;
    onCredentialsChange: (credentials: RESTCredentials) => void;
    onValidation: (isValid: boolean) => void;
}

export default function RESTRepository({
    details,
    credentials,
    allTouched,
    editMode = false,
    onDetailsChange,
    onCredentialsChange,
    onValidation,
}: RESTRepositoryProps) {
    const [touched, setTouched] = useState<Dictionary<boolean>>({});

    const handleDetailsChange =
        (field: "url" | "username") => (event: React.ChangeEvent<HTMLInputElement>) => {
            const newDetails = _.cloneDeep(details);
            newDetails[field] = event.target.value;
            setTouched((prev) => ({ ...prev, [field]: true }));
            onDetailsChange(newDetails);
        };

    const handleCredentialsChange = (field: keyof RESTCredentials) => (value: string) => {
        const newCredentials = _.cloneDeep(credentials ?? {});
        newCredentials[field] = value;
        onCredentialsChange(newCredentials);
    };

    const handleValidation = useCallback(() => {
        const isValid =
            !_.isEmpty(details.url) &&
            (_.isEmpty(details.username) || !_.isEmpty(credentials?.password) || details.passwordSet);
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
                <Grid size={12}>
                    <TextField
                        label="REST Server URL"
                        value={details.url ?? ""}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        error={isTouched("url") && _.isEmpty(details.url)}
                        onChange={handleDetailsChange("url")}
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
                    <SecretField
                        label="Password"
                        value={credentials?.password ?? ""}
                        isSet={details.passwordSet}
                        fullWidth
                        disabled={!editMode}
                        variant="outlined"
                        validate={allTouched}
                        onChange={handleCredentialsChange("password")}
                    />
                </Grid>
            </Grid>
        </>
    );
}