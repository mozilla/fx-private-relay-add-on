#!/bin/bash

# script to run the sed commands in both OSX and linux (e.g., GitHub Action)
# the commands ...
# first remove the :8000 part of the http://127.0.0.1:8000 domain
# then replace all http://127.0.0.1 with the domain passed to the script

echo $1

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/:8000//g"  src/manifest.json src/js/background/background.js src/popup.html
    sed -i '' "s|http://127.0.0.1|$1|g" src/manifest.json src/js/background/background.js src/popup.html src/inpage-panel.html
else
    sed -i "s/:8000//g"  src/manifest.json src/js/background/background.js src/popup.html
    sed -i "s|http://127.0.0.1|$1|g" src/manifest.json src/js/background/background.js src/popup.html src/inpage-panel.html
fi
