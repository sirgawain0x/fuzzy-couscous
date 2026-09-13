// Empty stub used as a resolveAlias target to skip optional connector peer
// deps from `wagmi/connectors`. wagmi 3's barrel re-exports every connector
// (tempo, metaMask, etc.); when the corresponding peer dep is not installed,
// both webpack and turbopack would otherwise fail with "Module not found".
// We don't use those connectors, so aliasing them here lets the unused exports
// resolve to a no-op.
export {};
