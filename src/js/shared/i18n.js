document.addEventListener("DOMContentLoaded", async () => {
  const i18nContentElements = document.querySelectorAll(".i18n-content");
  i18nContentElements.forEach(el => {
    el.textContent = browser.i18n.getMessage(el.dataset.i18nMessageId);
  });
  const i18nContentAttributes = document.querySelectorAll(".i18n-attribute");
  i18nContentAttributes.forEach(el => {
    el.setAttribute(el.dataset.i18nAttribute, browser.i18n.getMessage(el.dataset.i18nMessageId));
  });
});
