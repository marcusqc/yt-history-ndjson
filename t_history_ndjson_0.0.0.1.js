(function() {
    const extractedBatch = [];
    const seenIds = new Set();
    let tickCount = 0;
    const MAX_TICKS = 10000;
    const INTERVAL_MS = 1500;
    let totalExtracted = 0;

    function extractVideoId(url) {
        const match = url.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return match ? match[1] : null;
    }

    function flushBatch() {
        if (extractedBatch.length === 0) return;
        const blob = new Blob(
            [extractedBatch.map(item => JSON.stringify(item)).join('\n') + '\n'],
            { type: "application/x-ndjson" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `yt_myactivity_stream_${Date.now()}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
        totalExtracted += extractedBatch.length;
        console.log(`[Flush] ${extractedBatch.length} lines exported. Cumulative total = ${totalExtracted}`);
        extractedBatch.length = 0;
    }

    function stripMediaAndClean(card) {
        if (!card || card.hasAttribute('data-cleaned')) return;
        const mediaElements = card.querySelectorAll("img, picture, source, video, iframe, svg, canvas");
        mediaElements.forEach(el => {
            try {
                if ("src" in el) el.src = "";
                if ("srcset" in el) el.srcset = "";
                el.remove();
            } catch (e) {}
        });
        try {
            while (card.firstChild) {
                card.removeChild(card.firstChild);
            }
            card.style.minHeight = "1px";
            card.style.height = "1px";
            card.setAttribute("data-cleaned", "true");
        } catch (e) {}
    }

    function findCardContainer(link) {
        return (
            link.closest("[data-date]") ||
            link.closest("[role='article']") ||
            link.closest("c-wiz[data-activity-id]") ||
            link.parentElement
        );
    }

    function triggerForceClick(element) {
        if (!element) return;
        const eventOptions = { bubbles: true, cancelable: true, view: window };
        element.dispatchEvent(new MouseEvent('pointerdown', eventOptions));
        element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        element.dispatchEvent(new MouseEvent('pointerup', eventOptions));
        element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
        element.click();
    }

    const interval = setInterval(() => {
        tickCount++;

        // 1. Force trigger the "Load more" button if visible
        const loadMoreBtn = document.querySelector("button[aria-label*='plus'], button[aria-label*='More'], c-wiz button");
        if (loadMoreBtn && loadMoreBtn.offsetWidth > 0 && loadMoreBtn.offsetHeight > 0) {
            const btnText = loadMoreBtn.innerText.toLowerCase();
            if (btnText.includes('plus') || btnText.includes('more') || btnText.includes('charger')) {
                console.log("⚡ Auto-clicker: Force-triggering 'Load more' button.");
                triggerForceClick(loadMoreBtn);
            }
        }

        // 2. Extract video links
        const links = document.querySelectorAll("a[href*='watch?v='], a[href*='youtu.be/'], a[href*='/shorts/']");

        links.forEach(link => {
            if (!document.contains(link)) return;
            const videoId = extractVideoId(link.href);
            if (!videoId) return;

            const card = findCardContainer(link);

            // Clean the card even if the video ID has already been collected
            if (seenIds.has(videoId)) {
                if (card) stripMediaAndClean(card);
                return;
            }

            seenIds.add(videoId);
            const title = link.innerText ? link.innerText.trim() : "";
            let dateRaw = "";
            if (card && card.hasAttribute && card.hasAttribute("data-date")) {
                dateRaw = card.getAttribute("data-date");
            }

            extractedBatch.push({
                id: videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                title: title,
                date_raw: dateRaw,
                extracted_at: new Date().toISOString()
            });

            if (card) stripMediaAndClean(card);
        });

        // 3. Clean orphan/residual cards
        const orphanCards = document.querySelectorAll("[role='article']:not([data-cleaned]), c-wiz[data-activity-id]:not([data-cleaned])");
        orphanCards.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (rect.bottom < window.innerHeight) {
                stripMediaAndClean(card);
            }
        });

        if (extractedBatch.length >= 250) {
            flushBatch();
        }

        if (tickCount % 10 === 0) {
            console.log(`[Tick ${tickCount}] Total unique = ${seenIds.size} | Batch pending = ${extractedBatch.length}`);
        }

        // Micro-scroll movement to wake up page intersection listeners
        window.scrollBy(0, -20);
        setTimeout(() => {
            window.scrollTo(0, document.body.scrollHeight);
        }, 50);

        if (tickCount >= MAX_TICKS) {
            clearInterval(interval);
            flushBatch();
            console.log(`✅ Run completed. Final unique IDs count: ${seenIds.size}`);
        }
    }, INTERVAL_MS);
})();