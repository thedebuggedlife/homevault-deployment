# shellcheck disable=SC2034

if [ -n "$__LIB_LOGGING" ]; then return 0; fi

__LIB_LOGGING=1

declare -g JSON_OUT=false

declare -a LOG_LINES=()

################################################################################
#                               COLOR DEFINITIONS

# Reset
COff='\033[0m'       # Text Reset

# Regular Colors
Black='\033[0;30m'        # Black
Red='\033[0;31m'          # Red
Green='\033[0;32m'        # Green
Yellow='\033[0;33m'       # Yellow
Blue='\033[0;34m'         # Blue
Purple='\033[0;35m'       # Purple
Cyan='\033[0;36m'         # Cyan
White='\033[0;37m'        # White

# Bold
BBlack='\033[1;30m'       # Black
BRed='\033[1;31m'         # Red
BGreen='\033[1;32m'       # Green
BYellow='\033[1;33m'      # Yellow
BBlue='\033[1;34m'        # Blue
BPurple='\033[1;35m'      # Purple
BCyan='\033[1;36m'        # Cyan
BWhite='\033[1;37m'       # White

# Underline
UBlack='\033[4;30m'       # Black
URed='\033[4;31m'         # Red
UGreen='\033[4;32m'       # Green
UYellow='\033[4;33m'      # Yellow
UBlue='\033[4;34m'        # Blue
UPurple='\033[4;35m'      # Purple
UCyan='\033[4;36m'        # Cyan
UWhite='\033[4;37m'       # White

# High Intensity
IBlack='\033[0;90m'       # Black
IRed='\033[0;91m'         # Red
IGreen='\033[0;92m'       # Green
IYellow='\033[0;93m'      # Yellow
IBlue='\033[0;94m'        # Blue
IPurple='\033[0;95m'      # Purple
ICyan='\033[0;96m'        # Cyan
IWhite='\033[0;97m'       # White

# Bold High Intensity
BIBlack='\033[1;90m'      # Black
BIRed='\033[1;91m'        # Red
BIGreen='\033[1;92m'      # Green
BIYellow='\033[1;93m'     # Yellow
BIBlue='\033[1;94m'       # Blue
BIPurple='\033[1;95m'     # Purple
BICyan='\033[1;96m'       # Cyan
BIWhite='\033[1;97m'      # White

clear_logging_colors() {
    COff=
    Black=
    Red=
    Green=
    Yellow=
    Blue=
    Purple=
    Cyan=
    White=
    BBlack=
    BRed=
    BGreen=
    BYellow=
    BBlue=
    BPurple=
    BCyan=
    BWhite=
    UBlack=
    URed=
    UGreen=
    UYellow=
    UBlue=
    UPurple=
    UCyan=
    UWhite=
    IBlack=
    IRed=
    IGreen=
    IYellow=
    IBlue=
    IPurple=
    ICyan=
    IWhite=
    BIBlack=
    BIRed=
    BIGreen=
    BIYellow=
    BIBlue=
    BIPurple=
    BICyan=
    BIWhite=
}

################################################################################
#                                   LOGGING

function stack_trace() {
  local i=0
  local frames=${#BASH_SOURCE[@]}
  
  echo "Stack trace:"
  for ((i=1; i<frames; i++)); do
    echo "  $i: ${BASH_SOURCE[$i]}:${BASH_LINENO[$i-1]} ${FUNCNAME[$i]}()"
  done
}

log() {
    if [ "$JSON_OUT" != true ]; then
        echo -e "$@" >&2
    else
        OPTIND=1
        while getopts "en" opt; do
            shift
        done
        LOG_LINES+=("$1")
    fi
}

log_header() {
    log "\n${BWhite}================================================================================\n$1${COff}\n"
}

log_warn() {
    log -n "\n🟡 ${BIYellow}WARN:${IYellow} $1${COff}\n\n"

}

log_error() {
    log -n "\n🔴 ${BIRed}ERROR:${IRed} $1${COff}\n\n$(stack_trace)\n\n"
}

log_invalid() {
    log -n "\n${Red}$1${COff}\n" >&2
}

log_done() {
    log -n "\n🎉 ${BWhite}All operations completed successfully${COff}\n\n"
}

log_options() {
    local -n flags_map="$1"    # Create a reference to the passed associative array
    local dividers=${2:-false}
    local indent=2             # Initial indent reduced to 1 space
    local extra_padding=5      # Extra padding between option and description
    local terminal_width
    terminal_width=$(tput cols 2>/dev/null || echo 80)
    local wrap_width=$((terminal_width - 8))  # Leave some margin

    # First pass: find the longest option to determine consistent indentation
    local max_option_length=0
    for option in "${!flags_map[@]}"; do
        local option_length=${#option}
        if ((option_length > max_option_length)); then
            max_option_length=$option_length
        fi
    done
    
    # Add extra padding to get total display width
    local display_width=$((max_option_length + extra_padding))
    
    # Second pass: print all options with consistent indentation
    for option in "${!flags_map[@]}"; do
        local description="${flags_map[$option]}"
        local padding=$((display_width - ${#option}))
        local desc_indent=$((indent + display_width + 1))  # +1 for space after option
        
        # shellcheck disable=SC2183
        if [ "$dividers" = true ]; then printf '%*s' "$terminal_width" | tr ' ' '-'; fi

        # Print option with padding to align all descriptions
        printf "%${indent}s%s%${padding}s" "" "$option" ""
        
        if [ -z "$description" ]; then
            # If description is empty, just print a newline
            log ""
            continue
        fi
        
        # Process the description, preserving newlines while wrapping text
        # This approach ensures proper indentation for all lines
        
        # Split description into lines while preserving empty lines
        local line_num=0
        while IFS= read -r line || [ -n "$line" ]; do
            # Wrap the current line to fit available width
            if [ $line_num -eq 0 ]; then
                # First line of description prints after option with a space
                echo "$line" | fold -s -w $((wrap_width - desc_indent)) | {
                    read -r first_wrapped || true
                    if [ -n "$first_wrapped" ]; then
                        log " $first_wrapped"
                        while read -r next_wrapped; do
                            printf "%${desc_indent}s%s\n" "" "$next_wrapped" | log
                        done
                    else
                        # Empty first line
                        log ""
                    fi
                }
            else
                # All subsequent lines get full indentation for each wrapped segment
                echo "$line" | fold -s -w $((wrap_width - desc_indent)) | while IFS= read -r wrapped; do
                    printf "%${desc_indent}s%s\n" "" "$wrapped" | log
                done
            fi
            line_num=$((line_num + 1))
        done <<< "$description"
        log ""
    done
}