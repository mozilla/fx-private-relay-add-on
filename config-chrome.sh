#!/bin/bash

# script to run the sed commands in both OSX and linux (e.g., GitHub Action)
# replace "menus" permission (Firefox) with Chrome-compability permission ("contextMenus")

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|menus|contextMenus|g" src/manifest.json
else
    sed -i "s|menus|contextMenus|g" src/manifest.json
fi
