import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = "https://eu.i.posthog.com";

let initialized = false;

export const initPostHog = () => {
  if (initialized) return;
  if (!POSTHOG_KEY) {
    console.warn("PostHog key not configured — analytics disabled");
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We'll track manually
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    autocapture: false,
  });
  initialized = true;
};

export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
  posthog.identify(userId, properties);
};

export const resetUser = () => {
  posthog.reset();
};

export const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  posthog.capture(event, properties);
};

// Session recording: only enable on specific pages
export const enableSessionRecording = () => {
  posthog.startSessionRecording();
};

export const disableSessionRecording = () => {
  posthog.stopSessionRecording();
};

export { posthog };
