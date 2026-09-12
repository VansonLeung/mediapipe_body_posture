const path = require('node:path');

const APP_URL = 'forma://app/';

function isAppURL(value, devURL) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    return devURL
      ? url.origin === new URL(devURL).origin
      : url.protocol === 'forma:' && url.host === 'app';
  } catch {
    return false;
  }
}

function assetPath(value, root) {
  if (!isAppURL(value)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) return null;
    const file = path.resolve(
      root,
      '.' + (pathname === '/' ? '/index.html' : pathname),
    );
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      return null;
    return file;
  } catch {
    return null;
  }
}

function allowsPermission(permission, details = {}) {
  if (permission === 'fullscreen') return true;
  if (permission !== 'media') return false;
  if (details.mediaTypes)
    return (
      details.mediaTypes.length > 0 &&
      details.mediaTypes.every((type) => type === 'video')
    );
  return details.mediaType === 'video';
}

module.exports = { APP_URL, isAppURL, assetPath, allowsPermission };
