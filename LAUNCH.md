# Launch plan: God's Eye View · Price Truth

## Why this format spreads
Bilawal Sidhu's "God's Eye View" got 5M+ YouTube views and hit #1 on GitHub Trending with one line: *"a spy satellite simulator in your browser, except the data is real."* It worked for three reasons:
1. The look is a forbidden ops room: HUD labels, thermal/night-vision modes, a globe.
2. The data is real, so people check it and argue about it.
3. It is open source and free, so people share and fork it.

We copy the frame and change the subject: **a spy satellite for the world's money.** The enemy is the news. The truth is price.

## Hooks (enemy + truth, one line)
- "The news tells you what to think. This satellite shows you where the money is actually going."
- "Every country on Earth, one question: are buyers or sellers in control?"
- "Headlines tell stories. Price tells the truth. So I built a satellite for it."
- "I tracked every major market on Earth. 54 of 97 broke down today." *(fill in today's numbers)*

## 40-second short (screen recording + voice)
1. **0-3 s.** Boot screen ("ESTABLISHING UPLINK… GOD'S EYE VIEW ONLINE"). Hook line.
2. **3-12 s.** The globe spins in FLIR (press `2`). "Hot = buying. Cold = selling. Every major market on Earth, every day."
3. **12-25 s.** Press `M`. "This month, sellers control 16 of 36 countries." Click the top call (for example BUY BRAZIL). The globe swings to it and the target box locks.
4. **25-35 s.** Drawer: "Price only does 3 things: breaks the high, breaks the low, or stays inside. Brazil broke last month's high, and the day, week, month, quarter and year all agree."
5. **35-40 s.** "Money moves before the news does. Link in bio. It's free."

Record at 1080×1920. Keep the cursor slow. Use FLIR or NVG for the thumbnail.

## X / Threads post
> I built a spy satellite for the world's money.
> 97 markets. 36 countries. Stocks and bonds.
> One question: who is really buying, and who is really selling?
> Today: [N] markets broke down, [N] broke up. Money favors the [West/East].
> Free, open source: [link]

Attach a 15-second screen capture (globe spin → FLIR → click a country). Use the page's SHARE INTEL button for daily posts: it copies the day's calls and the link.

## Daily loop (makes it a series, not one post)
- Every evening after the update, post the SHARE INTEL text plus a screenshot of the globe. Same time, same format.
- Weekly (Friday): "East vs West" short, from the W bars.
- Monthly / quarterly turn: the biggest content. "The month just closed: here is where the world's money moved."

## Before launch
- [ ] Publish the repo and turn on GitHub Pages (see the command in the README / hand-off).
- [ ] Run the workflow once by hand (Actions → Daily EOD update → Run). Check that Yahoo does not block the GitHub runner.
- [ ] Add a 1200×630 share image (`og.png`) and `og:image` / `og:url` tags, so link previews show the globe.
- [ ] Optional: a custom domain (for example `godseye.thestrat.ai`) through a CNAME.

Education, not investment advice. Keep the disclaimer in the footer and in the post text when you say "Buy" or "Sell".
