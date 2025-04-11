#!/bin/bash

echo "INITIALIZING NEXTCLOUD FULL TEXT SEARCH"

if ! elastic_password=$(<"$ELASTIC_SEARCH_PASSWORD_FILE"); then
    echo "Failed to read elastic search password from '$ELASTIC_SEARCH_PASSWORD_FILE'"
fi

./occ app:install fulltextsearch
./occ app:install fulltextsearch_elasticsearch
./occ app:install files_fulltextsearch

./occ config:app:set fulltextsearch app_navigation --value="1"
./occ config:app:set fulltextsearch enabled --value="yes"
./occ config:app:set fulltextsearch search_platform --value="OCA\FullTextSearch_Elasticsearch\Platform\ElasticSearchPlatform"

./occ config:app:set fulltextsearch_elasticsearch analyzer_tokenizer --value="standard"
./occ config:app:set fulltextsearch_elasticsearch elastic_host --value="http://$ELASTIC_SEARCH_USER:$elastic_password@$ELASTIC_SEARCH_HOST:9200"
./occ config:app:set fulltextsearch_elasticsearch elastic_index --value="$ELASTIC_SEARCH_INDEX"
./occ config:app:set fulltextsearch_elasticsearch enabled --value="yes"

./occ config:app:set files_fulltextsearch enabled --value="yes"
./occ config:app:set files_fulltextsearch files_local --value="1"
./occ config:app:set files_fulltextsearch files_office --value="1"
./occ config:app:set files_fulltextsearch files_open_result_directly --value="1"
./occ config:app:set files_fulltextsearch files_pdf --value="1"
./occ config:app:set files_fulltextsearch files_size --value="20"

./occ fulltextsearch:index

echo "FINISHED INITIALIZING FULL TEXT SEARCH"