const fs = require('fs');
const path = require('path');

const isRouteFile = (name) => /^route\.(ts|tsx|js|jsx)$/.test(name);

/** `/api/auth/[id]` -> `/api/auth/[^/]+`, catch-alls -> `.*`. */
const toRegex = (pattern) => {
  let source = '';
  for (const segment of pattern.split('/')) {
    if (!segment) continue;
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) source += '(?:/.*)?';
    else if (/^\[\.\.\..+\]$/.test(segment)) source += '/.*';
    else if (/^\[.+\]$/.test(segment)) source += '/[^/]+';
    else source += `/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  }
  return new RegExp(`^${source}/?$`);
};

/**
 * Every `route.*` file under the Next app's api directory, as a path plus a
 * matcher. Used to decide which app owns a request on the combined host.
 */
const scanNextApiRoutes = (webDir) => {
  const candidates = [path.join(webDir, 'src', 'app', 'api'), path.join(webDir, 'app', 'api')];
  const apiDir = candidates.find((dir) => fs.existsSync(dir));
  if (!apiDir) return [];

  const patterns = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}/${entry.name}`);
      else if (isRouteFile(entry.name)) patterns.push(prefix);
    }
  };
  walk(apiDir, '/api');

  return patterns.map((pattern) => ({ pattern, matcher: toRegex(pattern) }));
};

const matchesNextApiRoute = (routes, pathname) =>
  routes.some((route) => route.matcher.test(pathname));

module.exports = { scanNextApiRoutes, matchesNextApiRoute, toRegex };
