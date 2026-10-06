# CI only: match CVM v0.14.4, which does not build AppArmor into its kernel.
# Ubuntu still restricts user namespaces under the unnamed unconfined profile.
# An explicitly named profile permits Chromium to create its own sandbox.
abi <abi/4.0>,
profile sure-browser-acceptance flags=(unconfined) {
  userns,
}
