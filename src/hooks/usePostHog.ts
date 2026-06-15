import { useEffect } from "react";
import { trackEvent, enableSessionRecording, disableSessionRecording } from "@/lib/posthog";

/**
 * Track a page view and optionally enable session recording.
 */
export const usePageView = (
  eventName: string,
  properties?: Record<string, unknown>,
  options?: { enableRecording?: boolean }
) => {
  useEffect(() => {
    trackEvent(eventName, properties);

    if (options?.enableRecording) {
      enableSessionRecording();
      return () => {
        disableSessionRecording();
      };
    }
  }, []);
};
