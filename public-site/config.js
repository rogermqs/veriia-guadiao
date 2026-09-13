/**
 * Veriia landing page — deployment configuration.
 * Empty values keep the contact form in an explicit, non-persistent demo mode.
 * No credentials, API keys or secrets belong in a public frontend file.
 */
window.VERIIA_CONFIG = Object.freeze({
  contactEndpoint: '', // Example after backend implementation: '/api/leads'
  privacyUrl: '',      // Published, approved HTTPS privacy policy. Required for real submissions.
  requestTimeoutMs: 15000
});
