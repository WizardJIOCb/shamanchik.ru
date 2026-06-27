(() => {
  if (!("serviceWorker" in navigator)) return;

  const registerPwa = async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch (error) {
      console.warn("PWA registration failed:", error);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerPwa, { once: true });
  } else {
    registerPwa();
  }
})();
