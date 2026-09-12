const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  isAppURL,
  assetPath,
  allowsPermission,
} = require('../electron/security.cjs');

test('only the local app or exact development origin is trusted', () => {
  assert.equal(isAppURL('forma://app/#posture'), true);
  for (const url of [
    'https://example.com',
    'forma://other/',
    'forma://app.evil/',
    'forma://user@app/',
    'file:///tmp/index.html',
    'invalid',
  ]) {
    assert.equal(isAppURL(url), false, url);
  }
  assert.equal(
    isAppURL('http://127.0.0.1:5175/#posture', 'http://127.0.0.1:5175'),
    true,
  );
  assert.equal(
    isAppURL('http://127.0.0.1:5176/', 'http://127.0.0.1:5175'),
    false,
  );
});

test('asset serving cannot escape the built application', () => {
  const root = path.resolve('dist');
  assert.equal(assetPath('forma://app/', root), path.join(root, 'index.html'));
  assert.equal(
    assetPath('forma://app/wasm/vision_wasm_internal.wasm', root),
    path.join(root, 'wasm/vision_wasm_internal.wasm'),
  );
  for (const url of [
    'forma://app/..%2fpackage.json',
    'forma://app/%2e%2e%2fsecret',
    'forma://app/%00',
    'forma://app/%ZZ',
    'forma://other/index.html',
    'forma://app/..%5csecret',
  ]) {
    assert.equal(assetPath(url, root), null, url);
  }
});

test('permissions allow video and fullscreen, excluding microphone and unrelated APIs', () => {
  assert.equal(allowsPermission('media', { mediaType: 'video' }), true);
  assert.equal(allowsPermission('media', { mediaTypes: ['video'] }), true);
  assert.equal(allowsPermission('fullscreen'), true);
  for (const details of [
    {},
    { mediaType: 'unknown' },
    { mediaType: 'audio' },
    { mediaTypes: [] },
    { mediaTypes: ['audio', 'video'] },
  ]) {
    assert.equal(allowsPermission('media', details), false);
  }
  for (const permission of [
    'geolocation',
    'notifications',
    'display-capture',
    'clipboard-read',
    'openExternal',
  ]) {
    assert.equal(allowsPermission(permission), false);
  }
});
