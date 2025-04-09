#!/bin/bash

echo "SETTING UP DEFAULT QUOTA"

./occ config:app:set files default_quota --value "${NEXTCLOUD_DEFAULT_QUOTA} GB"

echo "FINISHED SETTING UP DEFAULT QUOTA"