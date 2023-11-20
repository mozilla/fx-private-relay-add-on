#!/bin/bash

# script to run the sed commands in both OSX and linux (e.g., GitHub Action)
# remove "contextMenus" permission (Firefox-only) from manifest.json
# Note: the last permission cannot be "menus" or the JSON file will create a linter error

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "/menus/d" src/manifest.json
else
    sed -i "/menus/d" src/manifest.json
fi
