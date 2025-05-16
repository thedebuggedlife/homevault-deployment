# shellcheck disable=SC2034

if [ -n "$__LIB_CMDLINE" ]; then return 0; fi

__LIB_CMDLINE=1

# shellcheck source=./logging.sh
source "$PROJECT_ROOT/lib/logging.sh"

print_usage() {
    if [ -z "$SELECTED_ACTION" ]; then
        echo -e "\nUsage: $0 [global options] <action> [action options]"
        echo -e "\nActions:\n"
        echo "  deploy      Installs and/or updates modules in the project."
        echo "  backup      Creates a new recovery snapshot with the current statue of the project."
        echo "  snapshots   List and/or manage existing recovery snapshots."
        echo "  restore     Recovers the state of the project from a previous snapshot."
        echo "  modules     Shows information about installed or available modules."
        echo -e "\nTo display help for an action:\n"
        echo "  $0 <action> --help"

    elif [ "$SELECTED_ACTION" = "deploy" ]; then
        echo -e "\nUsage: $0 [global options] deploy [deploy options]"
        echo -e "\nDeploy options:\n"
        echo "  -m, --module <module>           Includes the given module in the project. Can be specified multiple times."
        echo "      --module all                Enables all available modules."
        echo -e "  --rm <module>                   Removes a module that had been previously installed. ${IRed}Use with caution!${COff}" 
        echo "  -o, --override <var>=<value>    Override environment variable. Can be specified multiple times."
        echo "  --no-download                   Do not download appdata from GitHub. Only use if appdata was previously downloaded."
        echo -e "  --keep-compose                  Do not override previously deployed docker-compose files. ${IRed}Use with caution!${COff}"
        echo -e "  --override-versions             Override running versions with those specified in compose files. ${IRed}Use with caution!${COff}"
        echo "  --dry-run                       Execute docker compose in dry run mode."

    elif [ "$SELECTED_ACTION" = "backup" ]; then
        echo -e "\nUsage: $0 [global options] backup <action> [backup options]"
        echo -e "\nBackup actions:\n"
        echo "  init                            Initialize the backup configuration. Must be run once before creating a snapshot."
        echo "  run                             Create a new recovery snapshot."
        echo "  schedule                        Configure (or disable) the schedule for background backup operations."
        echo -e "\nBackup 'init' options:\n"
        echo "  --restic-env <env_file>         Use the specified file to initialize restic environment variables."
        echo "  --restic-var <var>=<value>      Specify a restic variable value. Can be specified multiple times."
        echo -e "\nBackup 'run' options:\n"
        echo "  --keep                          Exclude the new snapshot from the automatic retention policy."
        echo -e "\nBackup 'schedule' options:\n"
        echo "  --cron '<expression>'           Set the background schedule to the given expression. Expression MUST be wrapped in quotes."
        echo "                                  Help: https://www.uptimia.com/cron-expression-generator"
        echo "                                  Examples:"
        echo "                                    --cron '0 2 * * *'    (every day at 2AM)"
        echo "                                    --cron '0 0 * * 0'    (every Sunday at midnight)"
        echo "                                    --cron off            (disable background schedule)"
        echo "  --retention [policy]            Configure the retention policy for automatic snapshots."
        echo "                                  Format: '[#h][#d][#w][#m][#y]' Where: h=hour,d=day,w=week,m=month,y=year"
        echo "                                  Default: 30d12m10y"
        echo "                                  Examples:"
        echo "                                    --retention 24h7d (keep last 24 hourly and last 7 daily snapshots)"
        echo "                                    --retention 4w6m  (keep last 4 weekly and last 6 monthly snapshots)"
        echo "                                    --retention off   (disable policy, i.e. keep all snapshots)"
        echo -e "\nGlobal backup options:\n"
        echo "  --dry-run                       Execute restic in dry run mode."

    elif [ "$SELECTED_ACTION" = "snapshots" ]; then
        echo -e "\nUsage: $0 [global options] snapshots <action> [snapshot options]"
        echo -e "\Snapshot actions:\n"
        echo "  list                            Show a list of snapshots that have been taken."
        echo "  browse <snapshot_id> [dir]      Show the contents of a snapshot. Optionally, only files under [dir]."
        echo "  forget <snapshot_id>            Configure (or disable) the schedule for background backup operations."
        echo -e "\nSnapshot 'browse' options:\n"
        echo "  --recursive                     Include all files and folders recursively. Valid only when --browse is used."
        echo -e "\nSnapshot 'forget' options:\n"
        echo "  --dry-run                       Execute restic in dry run mode."

    elif [ "$SELECTED_ACTION" = "restore" ]; then
        echo -e "\nUsage: $0 [global options] restore [restore options]"
        echo -e "\nRestore options:\n"
        echo "  --local [appdata path]          Restore from a local appdata (default behavior). Cannot be used with --snapshot"
        echo "                                  If a path is not specified, it defaults to the configuration in project .env file."
        echo "  --snapshot [id]                 Restore from a remote snapshot. Cannot be used with --local"
        echo "                                  If a snapshot ID is not specified, it defaults to the latest snapshot taken."
        echo "  --restic-env <env_file>         Use the values in the specified .env file to locate the restic repository."
        echo "  --restic-var <var>=<value>      Specify a restic variable value. Can be specified multiple times."
        echo "  --dry-run                       Execute restic and docker compose in dry run mode."

    elif [ "$SELECTED_ACTION" = "modules" ]; then
        echo -e "\nUsage: $0 [global options] modules [modules options]"
        echo -e "\Modules options:\n"
        echo "  -a, --all                       Show information for all modules available. Otherwise only installed modules are shown."
    fi

    echo -e "\nGlobal options:\n"
    echo "  -h, --help                      Display this help message."
    echo "  -u, --user <user>               User to apply for file permissions. [Default: '$USER']"
    echo "  --always-ask                    Force interactive prompts for settings with a default or previously provided."
    echo "  --unattended                    Do not stop for any prompt. Safe prompts will be auto-accepted."
    echo "                                  Prompts that cannot be auto-accepted will cause the script to exit with a failure code."

    exit 1
}

parse_env_override() {
    local -n overrides=$3
    if [ -n "$2" ]; then
        # Parse override in form of: VARIABLE_NAME=VALUE
        if echo "$2" | grep -q '='; then
            # shellcheck disable=SC2034
            overrides["$(echo "$2" | cut -d '=' -f 1)"]="$(echo "$2" | cut -d '=' -f 2-)"
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

is_valid_action() {
    local -a valid_actions=("deploy" "backup" "snapshots" "restore" "modules")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

is_valid_backup_action() {
    local -a valid_actions=("init" "run" "schedule")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

is_valid_snapshots_action() {
    local -a valid_actions=("list" "browse" "forget")
    array_contains "$1" "${valid_actions[@]}" || return 1
}

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
        --no-download)
            NO_DOWNLOAD=true
            return 1
            ;;
        --dry-run)
            DRY_RUN=true
            return 1
            ;;
    esac
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
    return 1
}

parse_backup_run_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        --keep)
            BACKUP_KEEP=true
            return 1
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

parse_modules_option() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        -a | --all)
            SHOW_ALL=true
            return 1
            ;;
    esac
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
        --unattended)
            UNATTENDED=true
            USE_DEFAULTS=true
            return 1
            ;;
        --always-ask)
            USE_DEFAULTS=false
            return 1
            ;;
        -h | --help)
            print_usage
            ;;
    esac
}

parse_command_line() {
    local count action
    while [ "$#" -gt 0 ]; do
        parse_global_option "$@"
        count=$?
        if [ "$count" -gt 0 ]; then
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
                if [ "$count" -gt 0 ]; then
                    shift "$count"
                    continue
                fi
            }
        fi
        log_invalid "Unrecognized parameter: '$1'"
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