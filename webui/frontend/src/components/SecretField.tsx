import { BaseTextFieldProps, TextField, TextFieldVariants } from "@mui/material"
import _ from "lodash";
import { ChangeEvent, useMemo, useState } from "react";

export interface SecretFieldProps extends BaseTextFieldProps {
    isSet: boolean;
    onChange: (value: string) => void;
    validate: boolean;
    variant: TextFieldVariants
}

export default function SecretField(props: SecretFieldProps) {
    const { isSet, onChange, validate, ...childProps } = props;
    const { disabled, helperText, value } = childProps;
    const [touched, setTouched] = useState(false);
    const [focused, setFocused] = useState(false);

    const error = props.error || ((touched || validate) && _.isEmpty(value) && !isSet);

    const displayValue = useMemo(() => {
        if (focused || !_.isEmpty(value) || !isSet) {
            return value;
        }
        return "••••••••";
    }, [focused, isSet, value])

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement|HTMLInputElement>) => {
        setTouched(true);
        onChange(event.target.value);
    }

    return (
        <TextField
            {...childProps}
            value={displayValue}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            error={error}
            onChange={handleChange}
            helperText={helperText ?? (!disabled && isSet ? "Leave empty to use existing value" : "")}
        />
    )
}