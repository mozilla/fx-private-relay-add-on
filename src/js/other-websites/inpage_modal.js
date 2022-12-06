

async function iframeCloseRelayInPageModal() {
    // document.removeEventListener("keydown", handleKeydownEvents);
    await browser.runtime.sendMessage({ method: "iframeCloseRelayInPageModal" });
  }

async function handleKeydownEvents(e) {
  if (e.key === "Escape") {
    console.log("keydown escape");
    preventDefaultBehavior(e);
    await iframeCloseRelayInPageModal();
    // console.log("escape");
  }
}

  // Set Listeners
  document.addEventListener("keydown", handleKeydownEvents);
