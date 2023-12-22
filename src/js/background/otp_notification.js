// TODO: Instead of polling, use a better strategy that won't waste resources.

poll();

async function poll() {
	const { receiveOtpNotifications } = await browser.storage.local.get("receiveOtpNotifications");
	const notificationsDisabled = receiveOtpNotifications !== "otp-notifications-enabled";

	if (notificationsDisabled) {
		// Clear the previous interval we set up for polling
		const { pollId }= await browser.storage.local.get("pollId");
		
		if (pollId) {
			clearInterval(pollId);
			await browser.storage.local.remove("pollId");
		}
		return;
	}

	let id = setInterval(getPotentialOtpCode, 1500);
	browser.storage.local.set({"pollId": id});
}

async function getPotentialOtpCode(method = "GET", opts=null) {
  const { relayApiSource } = await browser.storage.local.get("relayApiSource");  
  const relayApiUrlOtpCode = `${relayApiSource}/detected_email_otp_code/`;
  const headers = await createNewHeadersObject({auth: true});
  
	const response = await fetch(relayApiUrlOtpCode, {
    mode: "same-origin",
    method,
    headers: headers,
  });

  if (!response.ok) {
		return { status: 404 }
  }
	
  const answer = await response.json(); 
	notifyOTP(
    {
      filter: "notify",
			otp_code: answer.potential_otp_code,
			mask: answer.mask
    },
  );
  return answer;
}

const notifyOTP = (message) => {
	if (typeof message === "object" && typeof message?.filter === "string" && message.filter === "notify") {
		// TODO: use i18n translations
		let title = `One-time-code: ${message.otp_code}`;
		let content = `A potential one-time-code was sent to ${message.mask}.`;
		browser.notifications.create({
			"type": "basic",
			"iconUrl": browser.extension.getURL("icons/icon_48.png"),
			"title": title,
			"message": content
		});
	}
}
browser.runtime.onMessage.addListener(notifyOTP);
