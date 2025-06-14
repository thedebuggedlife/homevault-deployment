# shellcheck disable=SC2034

if [ -n "$__LIB_CMDLINE" ]; then return 0; fi

__LIB_CMDLINE=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"
# shellcheck source=./backup.sh
source "$PROJECT_ROOT/lib/backup.sh"

print_usage() {
    if [ -z "$SELECTED_ACTION" ]; then
        log "\nUsage: $0 [global options] <action> [action options]"
        log "\nActions:\n"
        log "  deploy       Installs and/or updates modules in the project."
        log "  backup       Creates a new recovery snapshot with the current statue of the project."
        log "  snapshots    List and/or manage existing recovery snapshots."
        log "  restore      Recovers the state of the project from a previous snapshot."
        log "  modules      Shows information about installed or available modules."
        log "  webui        Manage the WebUI installation."
        log "\nTo display help for an action:\n"
        log "  $0 <action> --help"

    elif [ "$SELECTED_ACTION" = "deploy" ]; then
        log "\nUsage: $0 [global options] deploy [deploy options]"
        log "\nDeploy options:\n"
        log "  -m, --module <module>            Includes the given module in the project. Can be specified multiple times."
        log "      --module all                 Enables all available modules."
        log "  --rm <module>                    Removes a module that had been previously installed. ${IRed}Use with caution!${COff}" 
        log "  -o, --override <var>=<value>     Override environment variable. Can be specified multiple times."
        log "      --override <file>            Override environment variables with those in specified file (.env format)"
        log "  --keep-compose                   Do not override previously deployed docker-compose files. ${IRed}Use with caution!${COff}"
        log "  --override-versions              Override running versions with those specified in compose files. ${IRed}Use with caution!${COff}"
        log "  --dry-run                        Execute docker compose in dry run mode."

    elif [ "$SELECTED_ACTION" = "backup" ]; then
        log "\nUsage: $0 [global options] backup <action> [backup options]"
        log "\nBackup actions:\n"
        log "  init                         Initialize the backup configuration. Must be run once before creating a snapshot."
        log "  info                         Show configuration and statistics about the repository."
        log "  run                          Create a new recovery snapshot."
        log "  schedule                     Configure (or disable) the schedule for background backup operations."
        log "\nBackup 'info' options:\n"
        log "  --env-only                   Only show restic configuration."
        log "\nBackup 'init' options:\n"
        log "  --restic-env <env_file>      Use the specified file to initialize restic environment variables."
        log "  --restic-var <var>=<value>   Specify a restic variable value. Can be specified multiple times."
        log "\nBackup 'run' options:\n"
        log "  --keep                       Exclude the new snapshot from the automatic retention policy."
        log "\nBackup 'schedule' options:\n"
        log "  --enable                     Turn ON background schedules."
        log "  --disable                    Turn OFF background schedules."
        log "  --cron '<expression>'        Sets the background schedule to the given expression. Expression MUST be wrapped in quotes."
        log "                               Help: https://www.uptimia.com/cron-expression-generator"
        log "                               Default: '0 2 * * *'    (every day at 2AM)"
        log "                               Examples:"
        log "                                 --cron '0 0 * * 0'    (every Sunday at midnight)"
        log "                                 --cron '0 0 1 * *'    (first day of each month at midnight)"
        log "  --retention <policy>         Configure the retention policy for automatic snapshots."
        log "                               Format: '[#h][#H][#d][#D][#w]|[#W][#m][#M][#y][#Y]' Where:"
        log "                                 #(h|d|w|m|y) keep only the most recent (hourly|daily|weekly|monthly|yearly)"
        log "                                              snapshot for the last #(hours|days|weeks|months|years)"
        log "                                 #(H|D|W|M|Y) keep all (hourly|daily|weekly|monthly|yearly) snapshots"
        log "                                              for the last #(hours|days|weeks|months|years)"
        log "                               Default: 7D4W16M10Y"
        log "                               Examples:"
        log "                                 --retention 24H7D keep all hourly snapshots for the past day"
        log "                                                   and all daily snapshots for the past week"
        log "                                 --retention 7d    keep only most recent daily snapshot for the last week"
        log "                                 --retention all   keep all snapshots"
        log "\nGlobal backup options:\n"
        log "  --dry-run                    Execute restic in dry run mode."

    elif [ "$SELECTED_ACTION" = "snapshots" ]; then
        log "\nUsage: $0 [global options] snapshots <action> [snapshot options]"
        log "\Snapshot actions:\n"
        log "  list [snapshot_id]           Show a list of snapshots that have been taken."
        log "                               You can specify single snapshot ID to filter output (optional)."
        log "  browse <snapshot_id> [dir]   Show the contents of a snapshot. Optionally, only files under [dir]."
        log "  forget <snapshot_id>         Configure (or disable) the schedule for background backup operations."
        log "\nSnapshot 'browse' options:\n"
        log "  --recursive                  Include all files and folders recursively. Valid only when --browse is used."
        log "\nSnapshot 'forget' options:\n"
        log "  --dry-run                    Execute restic in dry run mode."

    elif [ "$SELECTED_ACTION" = "restore" ]; then
        log "\nUsage: $0 [global options] restore [restore options]"
        log "\nRestore options:\n"
        log "  --local [appdata path]       Restore from a local appdata (default behavior). Cannot be used with --snapshot"
        log "                               If a path is not specified, it defaults to the configuration in project .env file."
        log "  --snapshot [id]              Restore from a remote snapshot. Cannot be used with --local"
        log "                               If a snapshot ID is not specified, it defaults to the latest snapshot taken."
        log "  --restic-env <env_file>      Use the values in the specified .env file to locate the restic repository."
        log "  --restic-var <var>=<value>   Specify a restic variable value. Can be specified multiple times."
        log "  --dry-run                    Execute restic and docker compose in dry run mode."

    elif [ "$SELECTED_ACTION" = "modules" ]; then
        log "\nUsage: $0 [global options] modules [modules options]"
        log "\Modules options:\n"
        log "  -a, --all                    Show information for all modules available. Otherwise only installed modules are shown."

    elif [ "$SELECTED_ACTION" = "webui" ]; then
        log "\nUsage: $0 [global options] webui <action> [webui options]"
        log "\nWebUI actions:\n"
        log "  install                  Download and install the WebUI"
        log "\nWebUI 'install' options:\n"
        log "  --skip-deploy            Do not trigger a deployment if traefik is detected to be running."
    fi

    log "\nGlobal options:\n"
    log "  -h, --help               Display this help message."
    log "  -v, --version            Display the installer version."
    log "  -u, --user <user>        User to apply for file permissions. [Default: '$USER']"
    log "  --json                   Format output in JSON (for use from webUI or automation tools)."
    log "  --always-ask             Force interactive prompts for settings with a default or previously provided."
    log "  --no-download            Do not download data from GitHub. Only use if all selected modules have been previously deployed."
    log "  --unattended             Do not stop for any prompt. Safe prompts will be auto-accepted."
    log "                           Prompts that cannot be auto-accepted will cause the script to exit with a failure code."

    exit 1
}

################################################################################
#                                HELPER FUNCTIONS

parse_env_override() {
    local -n overrides=$3
    if [ -n "$2" ]; then
        # Parse override in form of: VARIABLE_NAME=VALUE
        if echo "$2" | grep -q '='; then
            # shellcheck disable=SC2034
            overrides["$(echo "$2" | cut -d '=' -f 1)"]="$(echo "$2" | cut -d '=' -f 2-)"
        elif [ -f "$2" ]; then
            read_overrides "$2" || return 1
        else
            log_invalid "$1 requires an assignment in the form VARIABLE_NAME=VALUE."
            return 1
        fi
    else
        log_invalid "$1 requires an assignment in the form VARIABLE_NAME=VALUE."
        return 1
    fi
}

parse_file_ref() {
    local -n file=$3
    if [ -n "$file" ]; then
        log_invalid "$1 can only be specified once"
        return 1
    fi
    if [ -z "$2" ]; then
        log_invalid "$1 requires a value."
        return 1
    fi
    if [ ! -f "$2" ]; then
        log_invalid "$1: File '$2' does not exist"
        return 1
    fi
    file="$2"
}

################################################################################
#                              DEPLOYMENT OPTIONS

parse_deploy_option() {
    local module
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        ## DEPLOY OPTIONS
        --module | -m)
            if [ -z "$2" ]; then
                log_invalid "$1 requires a value."
                exit 1
            fi
            module=$(echo "$2" | tr '[:upper:]' '[:lower:]')
            if [ "$module" = "all" ]; then 
                find_all_modules
            else
                ENABLED_MODULES+=("$module")
            fi
            dedup_modules
            return 2
            ;;
        --rm)
            if [ -z "$2" ]; then
                log_invalid "$1 requires a value."
                exit 1
            fi
            module=$(echo "$2" | tr '[:upper:]' '[:lower:]')
            REMOVE_MODULES+=("$module")
            return 2
            ;;
        --keep-compose)
            OVERRIDE_COMPOSE=false
            return 1
            ;;
        --override | -o)
            parse_env_override "$1" "$2" ENV_OVERRIDES || exit 1
            return 2
            ;;
        --override-versions)
            OVERRIDE_VERSIONS=true
            return 1
            ;;
        --dry-run)
            DRY_RUN=true
            return 1
            ;;
    esac
}

################################################################################
#                              BACKUP OPTIONS

is_valid_backup_action() {
    local -a valid_actions=("init" "run" "schedule" "info")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

parse_backup_init_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --restic-var)
            parse_env_override "$1" "$2" RESTIC_OVERRIDES || exit 1
            return 2
            ;;
        --restic-env)
            parse_file_ref "$1" "$2" RESTIC_INIT_ENV || exit 1
            return 2
            ;;
    esac
}

parse_backup_info_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --env-only)
            BACKUP_ENV_ONLY=true
            return 1
            ;;
    esac
}

parse_backup_run_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --keep)
            BACKUP_KEEP=true
            return 1
            ;;
    esac
}

parse_backup_schedule_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --enable)
            if [ -n "$BACKUP_ENABLED_CHANGE" ]; then
                log_invalid "Only one of '--enable' or '--disable' can be specified"
                return 255
            fi
            BACKUP_ENABLED_CHANGE=true
            return 1
            ;;
        --disable)
            if [ -n "$BACKUP_ENABLED_CHANGE" ]; then
                log_invalid "Only one of '--enable' or '--disable' can be specified"
                return 255
            fi
            BACKUP_ENABLED_CHANGE=false
            return 1
            ;;
        --cron)
            if [ "$BACKUP_SCHEDULE_CHANGE" = true ]; then
                log_invalid "$1 can only be specified once"
                return 255
            fi
            if [ -z "$2" ]; then
                log_invalid "$1 requires a value."
                return 255
            fi
            local result
            result=$(validate_cron_regex "$2") || {
                log_invalid "$result"
                return 255
            }
            BACKUP_SCHEDULE_CHANGE="$2"
            return 2
            ;;
        --retention)
            if [ "$BACKUP_RETENTION_POLICY_CHANGE" = true ]; then
                log_invalid "$1 can only be specified once"
                return 255
            fi
            if [ -z "$2" ]; then
                log_invalid "$1 requires a value."
                return 255
            fi
            local result
            result=$(validate_retention_policy "$2") || {
                log_invalid "$result"
                return 255
            }
            BACKUP_RETENTION_POLICY_CHANGE="$2"
            return 2
            ;;
    esac
}

parse_backup_option() {
    local action
    if [ -z "$BACKUP_ACTION" ]; then
        action=$(echo "$1" | tr '[:upper:]' '[:lower:]')
        is_valid_backup_action "$action" && {
            BACKUP_ACTION="$action"
            return 1
        } || return 0
    else
        ## GLOBAL BACKUP OPTIONS
        case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
            --dry-run)
                DRY_RUN=true
                return 1
                ;;
        esac
        type "parse_backup_${BACKUP_ACTION}_option" &>/dev/null && {
            parse_backup_"${BACKUP_ACTION}"_option "$@"
            return $?
        } || return 0
    fi
}

check_backup_options() {
    if [ -z "$BACKUP_ACTION" ]; then
        log_invalid "A backup action was not specified"
        return 1
    fi
}

################################################################################
#                              SNAPSHOTS OPTIONS

is_valid_snapshots_action() {
    local -a valid_actions=("list" "browse" "forget")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

parse_snapshots_browse_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --recursive)
            SNAPSHOT_BROWSE_FLAGS+=("--recursive")
            return 1
            ;;
    esac
}

parse_snapshots_forget_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --dry-run)
            DRY_RUN=true
            return 1
            ;;
    esac
}

parse_snapshots_option() {
    local action
    if [ -z "$SNAPSHOT_ACTION" ]; then
        action=$(echo "$1" | tr '[:upper:]' '[:lower:]')
        if is_valid_snapshots_action "$action"; then
            SNAPSHOT_ACTION="$action"
            ## Check for required options
            case "$action" in
                list)
                    if [[ -n "$2" && "$2" != -* ]]; then
                        SNAPSHOT_ID="$2"
                        return 2
                    else
                        SNAPSHOT_ID=
                        return 1
                    fi
                    ;;
                browse)
                    if [[ -n "$2" && "$2" != -* ]]; then
                        SNAPSHOT_ID="$2"
                    else
                        log_invalid "snapshot browse: a snapshot ID is required"
                        exit 1
                    fi
                    if [[ -n "$3" && "$3" != -* ]]; then
                        SNAPSHOT_BROWSE_FLAGS+=("$3")
                        return 3
                    else
                        return 2
                    fi
                    ;;
                forget)
                    if [[ -n "$2" && "$2" != -* ]]; then
                        SNAPSHOT_ID="$2"
                    else
                        log_invalid "snapshot forget: a snapshot ID is required"
                        exit 1
                    fi
                    return 2
                    ;;
                *) return 1 ;;
            esac
        fi
    else
        ## SNAPSHOT ACTION OPTIONS
        type "parse_snapshots_${SNAPSHOT_ACTION}_option" &>/dev/null &&
            parse_snapshots_"${SNAPSHOT_ACTION}"_option "$@" && 
            return $?
    fi
}

check_snapshots_options() {
    if [ -z "$SNAPSHOT_ACTION" ]; then
        log_invalid "A snapshot action was not specified"
        return 1
    fi
}

################################################################################
#                              RESTORE OPTIONS

parse_restore_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --local)
            if [ -n "$RESTORE_ACTION" ]; then
                log_invalid "$1 cannot be used in combination with --$RESTORE_ACTION"
                exit 1
            fi
            RESTORE_ACTION=local
            if [[ -n "$2" && "$2" != -* ]]; then
                APPDATA_LOCATION="$2"
                return 2
            else
                return 1
            fi
            ;;
        --snapshot)
            if [ -n "$RESTORE_ACTION" ]; then
                log_invalid "$1 cannot be used in combination with --$RESTORE_ACTION"
                exit 1
            fi
            RESTORE_ACTION=snapshot
            if [[ -n "$2" && "$2" != -* ]]; then
                SNAPSHOT_ID="$2"
                return 2
            else
                return 1
            fi
            ;;
        --restic-env)
            parse_file_ref "$1" "$2" RESTIC_ENV || exit 1
            return 2
            ;;
        --restic-var)
            parse_env_override "$1" "$2" RESTIC_OVERRIDES || exit 1
            return 2
            ;;
        --dry-run)
            DRY_RUN=true
            return 1
            ;;
    esac
}

check_restore_options() {
    if [ -z "$RESTORE_ACTION" ]; then
        log_invalid "One of '--local' or '--snapshot' must be provided"
        return 1
    fi
}

################################################################################
#                              MODULES OPTIONS

parse_modules_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        -a | --all)
            SHOW_ALL=true
            return 1
            ;;
    esac
}

################################################################################
#                              WEBUI OPTIONS

is_valid_webui_action() {
    local -a valid_actions=("install" "config")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

parse_webui_install_option() {
    local module
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        ## WEBUI INSTALL OPTIONS
        --skip-deploy)
            WEBUI_SKIP_DEPLOY=true
            return 1
            ;;
    esac
}

parse_webui_config_option() {
    local module
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        ## WEBUI CONFIG OPTIONS
        --module | -m)
            if [ -z "$2" ]; then
                log_invalid "$1 requires a value."
                exit 1
            fi
            module=$(echo "$2" | tr '[:upper:]' '[:lower:]')
            ENABLED_MODULES+=("$module")
            dedup_modules
            return 2
            ;;
        --rm)
            if [ -z "$2" ]; then
                log_invalid "$1 requires a value."
                exit 1
            fi
            module=$(echo "$2" | tr '[:upper:]' '[:lower:]')
            remove_from_array ENABLED_MODULES "$module"
            return 2
            ;;
    esac
}

parse_webui_option() {
    local action
    if [ -z "$WEBUI_ACTION" ]; then
        action=$(echo "$1" | tr '[:upper:]' '[:lower:]')
        if is_valid_webui_action "$action"; then
            WEBUI_ACTION="$action"
            return 1
        fi
    else
        type "parse_webui_${WEBUI_ACTION}_option" &>/dev/null && {
            parse_webui_"${WEBUI_ACTION}"_option "$@"
            return $?
        } || return 0
    fi
}

check_webui_options() {
    if [ -z "$WEBUI_ACTION" ]; then
        log_invalid "A webui action was not specified"
        return 1
    fi
}

################################################################################
#                              GLOBAL OPTIONS

is_valid_action() {
    local -a valid_actions=("deploy" "backup" "snapshots" "restore" "modules" "webui")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

parse_global_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        ## GLOBAL OPTIONS
        --user | -u)
            if [ -n "$2" ]; then
                AS_USER="$2"
                return 2
            else
                log_invalid "$1 requires a value."
                exit 1
            fi
            ;;
        --json)
            JSON_OUT=true
            clear_logging_colors
            return 1
            ;;
        --unattended)
            UNATTENDED=true
            COMPOSE_OPTIONS="${COMPOSE_OPTIONS} --ansi never"
            return 1
            ;;
        --force)
            FORCE=true
            return 1
            ;;
        --always-ask)
            USE_DEFAULTS=false
            return 1
            ;;
        --no-download)
            NO_DOWNLOAD=true
            return 1
            ;;
        -v | --version)
            log "$PROJECT_VERSION"
            exit 0
            ;;
        -h | --help)
            print_usage
            ;;
    esac
}

################################################################################
#                                  MAIN PARSER

parse_command_line() {
    local count action min_error=255
    while [ "$#" -gt 0 ]; do
        parse_global_option "$@"
        count=$?
        if [[ "$count" -gt 0 && "$count" -lt $min_error ]]; then
            shift "$count"
            continue
        fi
        if [ -z "$SELECTED_ACTION" ]; then
            action=$(echo "$1" | tr '[:upper:]' '[:lower:]')
            is_valid_action "$action" && {
                SELECTED_ACTION="$action"
                shift
                continue
            }
        else
            type "parse_${SELECTED_ACTION}_option" &>/dev/null && {
                parse_"${SELECTED_ACTION}"_option "$@"
                count=$?
                if [[ "$count" -gt 0 && "$count" -lt $min_error ]]; then
                    shift "$count"
                    continue
                fi
            }
        fi
        if [ "$count" -lt $min_error ]; then
            log_invalid "Unrecognized parameter: '$1'"
        fi
        print_usage
    done
    if [ -z "$SELECTED_ACTION" ]; then
        log_invalid "An action was not specified"
        print_usage
    fi
    type "check_${SELECTED_ACTION}_options" &>/dev/null && {
        check_"${SELECTED_ACTION}"_options || print_usage
    }
}