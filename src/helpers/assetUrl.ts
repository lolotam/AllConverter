// Changes on every server start, i.e. every deploy, so browsers and CDNs such as
// Cloudflare fetch the new CSS/JS instead of a copy cached from an older release.
const ASSET_VERSION = Date.now().toString(36);

export const assetUrl = (webroot: string, file: string) => `${webroot}/${file}?v=${ASSET_VERSION}`;
