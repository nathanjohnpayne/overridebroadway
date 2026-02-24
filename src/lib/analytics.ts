import { logEvent } from "firebase/analytics";
import { getFirebaseAnalytics } from "./firebase";

async function getAnalyticsInstance() {
  return await getFirebaseAnalytics();
}

export async function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      logEvent(analytics, eventName, params);
    }
  } catch {
    // Analytics errors should never break the app
  }
}

// Pre-defined events for the app
export const Analytics = {
  pageView: (pageName: string) =>
    trackEvent("page_view", { page_name: pageName }),

  signUp: (method: "email" | "google") =>
    trackEvent("sign_up", { method }),

  login: (method: "email" | "google") =>
    trackEvent("login", { method }),

  productionCreated: () =>
    trackEvent("production_created"),

  dealInputsSaved: (productionId: string) =>
    trackEvent("deal_inputs_saved", { production_id: productionId }),

  scenarioRun: (scenarioName: string) =>
    trackEvent("scenario_run", { scenario_name: scenarioName }),

  sensitivityGridViewed: () =>
    trackEvent("sensitivity_grid_viewed"),

  artworkUploaded: () =>
    trackEvent("artwork_uploaded"),

  agreementUploaded: () =>
    trackEvent("agreement_uploaded"),

  modelViewed: (recoupWeek: number | null) =>
    trackEvent("model_viewed", { recoup_week: recoupWeek ?? -1 }),

  investorAdded: () =>
    trackEvent("investor_added"),

  investorDocUploaded: (docType: string) =>
    trackEvent("investor_doc_uploaded", { doc_type: docType }),

  capitalizationViewed: (productionId: string) =>
    trackEvent("capitalization_viewed", { production_id: productionId }),

  producerPoolCreated: () =>
    trackEvent("producer_pool_created"),

  // Deal Room events
  dealRoomCreated: (productionId: string) =>
    trackEvent("deal_room_created", { production_id: productionId }),

  dealRoomViewed: (token: string) =>
    trackEvent("deal_room_viewed", { token }),

  dealRoomLinkCopied: (productionId: string) =>
    trackEvent("deal_room_link_copied", { production_id: productionId }),

  dealRoomDeactivated: (productionId: string) =>
    trackEvent("deal_room_deactivated", { production_id: productionId }),

  dealRoomUpdated: (productionId: string) =>
    trackEvent("deal_room_updated", { production_id: productionId }),
};
