(function initSiteTabs() {
	const tabs = document.querySelectorAll("[data-site-tab]");
	const panels = document.querySelectorAll("[data-site-panel]");

	function show(id) {
		tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.siteTab === id));
		panels.forEach((p) => p.classList.toggle("is-active", p.dataset.sitePanel === id));
		if (id === "home") location.hash = "";
		else location.hash = id;
	}

	tabs.forEach((t) => {
		t.addEventListener("click", () => show(t.dataset.siteTab));
	});

	const hash = location.hash.replace("#", "");
	if (hash === "harnesses" || hash === "performance") show(hash);
	else show("home");
})();
