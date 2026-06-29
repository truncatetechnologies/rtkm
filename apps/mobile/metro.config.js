// Metro config for the monorepo. @rtkm/shared is installed as a file: dependency
// (symlinked into node_modules); we watch its source folder so edits hot-reload.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const sharedRoot = path.resolve(workspaceRoot, "packages", "shared");

const config = getDefaultConfig(projectRoot);

// Watch the shared package source so symlinked changes are picked up.
config.watchFolders = [sharedRoot];

// Resolve from the app's own node_modules first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
