/**
 * Immutable publication versions. Preserve archives when publishing new wording.
 * Changes to bundled cancellation/privacy wording must also advance the guest
 * and host bundle versions and their trusted database manifests, so existing
 * confirmations are never treated as acceptance of unseen documents.
 */
export const GUEST_TERMS_VERSION = "qualia_guest_2026_10_13_v1";
export const HOST_TERMS_VERSION = "qualia_host_2026_10_13_v1";
export const PRIVACY_VERSION = "qualia_privacy_2026_10_13_v1";
export const CANCELLATION_POLICY_VERSION = "qualia_cancellation_2026_10_13_v1";
// The owner approved this release on October 12 in Qualia's Miami time zone.
export const LEGAL_EFFECTIVE_DATE = "October 12, 2026";
export const LEGAL_SUPPORT_EMAIL = "support@bookqualia.com";
