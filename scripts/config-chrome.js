#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "src", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function isHostPermission(permission) {
  return permission === "<all_urls>" || /^[a-z*]+:\/\/.+/.test(permission);
}

manifest.manifest_version = 3;

manifest.background = {
  service_worker: "js/background/service-worker.js",
};

if (manifest.browser_action) {
  manifest.action = {
    default_icon: manifest.browser_action.default_icon,
    default_popup: manifest.browser_action.default_popup,
  };
  delete manifest.browser_action;
}

delete manifest.browser_specific_settings;

const permissions = manifest.permissions ?? [];
const hostPermissions = new Set(manifest.host_permissions ?? []);
manifest.permissions = permissions.filter((permission) => {
  if (permission === "menus") {
    return false;
  }

  if (isHostPermission(permission)) {
    hostPermissions.add(permission);
    return false;
  }

  return true;
});

if (hostPermissions.size > 0) {
  manifest.host_permissions = Array.from(hostPermissions);
}

if (
  Array.isArray(manifest.web_accessible_resources) &&
  manifest.web_accessible_resources.every((resource) => typeof resource === "string")
) {
  manifest.web_accessible_resources = [
    {
      resources: manifest.web_accessible_resources,
      matches: ["<all_urls>"],
    },
  ];
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
