module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "webextensions": true,
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": "latest"
    },
    "ignorePatterns": ["fathom.js", "src/js/libs/**"],
    "globals": {
        "areInputIconsEnabled": "readonly",
        "createElementWithClassList": "readonly",
        "findEmailInputs": "readonly",
        "enableDataOptOut": "readonly",
        "fathom": "readonly",
        "fillInputWithAlias": "readonly",
        "getAliasesFromServer": "readonly",
        "getServerStoragePref": "readonly",
        "makeRelayAddress": "readonly",
        "preventDefaultBehavior": "readonly",
        "relayContextMenus": "readonly",
        "sendMetricsEvent": "readonly",
        "sendRelayEvent": "readonly",
        "setCustomFonts": "readonly"
    },
    "rules": {
        "no-unused-vars": [
            "error",
            { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
    }
}
