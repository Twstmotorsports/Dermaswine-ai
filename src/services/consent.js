/**
 * Screening consent gate.
 *
 * The app must collect explicit consent before opening the live camera or
 * analyzing an uploaded image. Consent is held for the current app session;
 * users are asked again on the next launch.
 */
let consented = false;

export const hasConsent = () => consented;

export const giveConsent = () => {
  consented = true;
};

export const revokeConsent = () => {
  consented = false;
};

export const CONSENT_POINTS = [
  'Captured or uploaded images are used only to screen for swine skin conditions.',
  'The live camera automatically captures a frame every few seconds while it is open. Use Pause or leave the screen to stop it.',
  'Images are sent to a hosted AI inference service for this analysis. Only detection details are saved to your history unless image storage is enabled.',
  'Results are AI-assisted preliminary classifications, not a veterinary diagnosis.',
  'You can delete detection records at any time from Detection History.',
];
