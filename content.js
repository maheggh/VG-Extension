// content.js

// Function to remove the <video-9x16-feedback> elements
function removeFeedbackForms() {
    // Remove any existing feedback forms
    const feedbackForms = document.querySelectorAll('video-9x16-feedback');
    feedbackForms.forEach(form => {
        form.remove();
    });

    // Observe the DOM for new feedback forms being added
    if (!window.feedbackObserver) {
        window.feedbackObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches('video-9x16-feedback')) {
                            node.remove();
                        } else if (node.querySelectorAll) {
                            const nestedFeedbackForms = node.querySelectorAll('video-9x16-feedback');
                            nestedFeedbackForms.forEach(form => form.remove());
                        }
                    }
                });
            });
        });

        window.feedbackObserver.observe(document.body, { childList: true, subtree: true });
    }
}

function getCategoriesFromPage() {
    const categorySet = new Set();
    document.querySelectorAll("section.kur-floor").forEach((section) => {
        section.querySelectorAll("a").forEach((linkElement) => {
            const href = linkElement.getAttribute("href");
            if (!href || !href.startsWith("https://")) return;

            const match = href.match(/^https:\/\/[^/]+\/([a-zA-Z-]+)\//);
            if (match && match[1]) {
                const category = match[1];
                categorySet.add(category);
            }
        });
    });

    // Reintroduce hardcoded filters
    const categoriesArray = Array.from(categorySet);
    categoriesArray.push("minigames", "p3", "radio", "video");
    return categoriesArray;
}

function sendDetectedCategories() {
    const categories = getCategoriesFromPage();
    chrome.runtime.sendMessage({ action: "detectedCategories", categories: categories });
}

function applyFilters(filters) {
    // Remove feedback forms regardless of filters
    removeFeedbackForms();

    // Hide or show the "DAGLIGE MINISPILL" section based on the "minigames" filter
    document.querySelectorAll("section.kur-floor").forEach((section) => {
        const titleText = section.querySelector(".kur-floor__title-text")?.textContent || "";
        if (titleText.includes("DAGLIGE MINISPILL")) {
            if (filters.includes("minigames")) {
                section.style.display = "none";
            } else {
                section.style.display = "block";
            }
            return; // Skip processing articles in this section
        }

        // Process articles within other sections
        section.querySelectorAll(".kur-room-wrapper").forEach((article) => {
            const link = article.querySelector("a");
            const href = link?.getAttribute("href") || "";
            let shouldHide = false;

            for (const category of filters) {
                if (category === "p3" && href.includes("p3.no")) {
                    shouldHide = true;
                    break;
                }
                if (category === "radio" && href.includes("radio.nrk.no")) {
                    shouldHide = true;
                    break;
                }
                if (category === "video") {
                    // Check if the article contains a video player
                    if (article.querySelector("nrkno-player")) {
                        shouldHide = true;
                        break;
                    }
                } else {
                    const categoryPattern = new RegExp(`/${category}/`, 'i');
                    if (categoryPattern.test(href)) {
                        shouldHide = true;
                        break;
                    }
                }
            }

            article.style.display = shouldHide ? "none" : "block";
        });
    });
}

// Initial execution
chrome.storage.local.get("selectedFilters", (data) => {
    if (data.selectedFilters) {
        applyFilters(data.selectedFilters);
    } else {
        // Even if no filters are selected, remove feedback forms
        removeFeedbackForms();
    }
});

// Send detected categories to the popup
sendDetectedCategories();

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "applyFilters") {
        const selectedFilters = message.filters;
        chrome.storage.local.set({ "selectedFilters": selectedFilters });
        applyFilters(selectedFilters);
    } else if (message.action === "showAll") {
        document.querySelectorAll("section.kur-floor").forEach((section) => {
            section.style.display = "block";
            section.querySelectorAll(".kur-room-wrapper").forEach((article) => {
                article.style.display = "block";
            });
        });
        // Even when showing all, remove feedback forms
        removeFeedbackForms();
    } else if (message.action === "requestCategories") {
        sendDetectedCategories();
    }
});
