if [ -n "$__LIB_BACKUP" ]; then return 0; fi

__LIB_BACKUP=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
# shellcheck source=./config.sh
source "$PROJECT_ROOT/lib/config.sh"

################################################################################
#                            CONFIGURATION FILES

save_restore_file() {
    local restore_file=$1
    local modules smtp_type="smtp2go"

    echo -e "Saving restore settings to ${Cyan}$restore_file${COff}" >&2

    modules=$(jq -n --args '$ARGS.positional' "${ENABLED_MODULES[@]}")
    if [ "$USE_SMTP2GO" = false ]; then smtp_type="custom"; fi
    jq -n --argjson modules "$modules" --arg smtp_type "$smtp_type" --arg version "$PROJECT_VERSION" '
    {
        version: $version,
        modules: $modules,
        smtp: $smtp_type,
    }
    ' > "$restore_file" && chmod 600 "$restore_file" || {
        log_error "Failed to save file '$restore_file'"
        return 1
    }
}

load_restore_file() {
    local restore_file=$1
    local smtp_type

    echo -e "Loading restore settings from ${Cyan}$restore_file${COff}" >&2

    readarray -t ENABLED_MODULES < <(jq -r '.modules[]' "$restore_file") || {
        log_error "Failed to read enabled modules from '$restore_file'"
        return 1
    }

    smtp_type=$(jq -r '.smtp' "$restore_file") || {
        log_error "Failed to read smtp type from '$restore_file'"
        return 1
    }

    if [ "$smtp_type" != "smtp2go" ]; then USE_SMTP2GO=false; fi
}