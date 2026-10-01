export const getPageTabId = (panelId: string, tabId: string) =>
  `${panelId}-tab-${encodeURIComponent(tabId)}`;