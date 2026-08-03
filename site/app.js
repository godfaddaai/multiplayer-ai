const demoSessions = [
  {
    provider: "CODEX",
    title: "Release hardening",
    turns: [
      '<article class="turn human maya">',
      '<header><span class="avatar avatar-maya">M</span><strong>Maya</strong><time>10:41</time></header>',
      '<p>Trace the invite boundary before we cut the alpha. I want direct session IDs to fail closed.</p>',
      '</article>',
      '<article class="turn agent">',
      '<header><span class="agent-glyph">✦</span><strong>Codex</strong><time>10:42</time></header>',
      '<p>I found the access check shared by list, transcript, presence, audit, and prompt routes. The direct-read test is the one missing assertion.</p>',
      '<pre><code><span>+</span> assert.equal(directRead.status, 404)<br><span>+</span> assert.equal(prompt.status, 404)</code></pre>',
      '</article>',
      '<article class="turn human alex remote-turn">',
      '<header><span class="avatar avatar-alex">A</span><strong>Alex</strong><span class="from-peer">via mpai</span><time>10:44</time></header>',
      '<p>Add the test, then run only the server suite. Don’t broaden the sharing default.</p>',
      '</article>',
      '<article class="system-turn"><i></i><span>Alex’s turn was attributed in Maya’s native Codex transcript</span></article>'
    ].join("")
  },
  {
    provider: "CLAUDE CODE",
    title: "Auth handoff",
    turns: [
      '<article class="turn human maya">',
      '<header><span class="avatar avatar-maya">M</span><strong>Maya</strong><time>10:18</time></header>',
      '<p>The refresh path still signs out active users. Map the cookie rotation before changing code.</p>',
      '</article>',
      '<article class="turn agent">',
      '<header><span class="agent-glyph claude-glyph">✺</span><strong>Claude Code</strong><time>10:20</time></header>',
      '<p>The old token is revoked before the replacement cookie is committed. I would make rotation transactional and preserve the family ID.</p>',
      '<pre><code><span>~</span> await rotateTokenFamily(session.id, tx)</code></pre>',
      '</article>',
      '<article class="turn human alex remote-turn">',
      '<header><span class="avatar avatar-alex">A</span><strong>Alex</strong><span class="from-peer">via mpai</span><time>10:23</time></header>',
      '<p>Yes. Add a concurrent-refresh test before implementation so we can see the race fail.</p>',
      '</article>',
      '<article class="system-turn"><i></i><span>Alex joined without asking Maya to paste 28 earlier turns</span></article>'
    ].join("")
  },
  {
    provider: "CODEX",
    title: "Billing refactor",
    turns: [
      '<article class="turn human maya">',
      '<header><span class="avatar avatar-maya">M</span><strong>Maya</strong><time>09:12</time></header>',
      '<p>Separate invoice calculation from provider delivery. Preserve every current rounding test.</p>',
      '</article>',
      '<article class="turn agent">',
      '<header><span class="agent-glyph">✦</span><strong>Codex</strong><time>09:15</time></header>',
      '<p>The boundary is cleanest at <code>InvoiceDraft</code>. Calculation stays pure; delivery receives the frozen draft and an idempotency key.</p>',
      '</article>',
      '<article class="turn human alex remote-turn">',
      '<header><span class="avatar avatar-alex">A</span><strong>Alex</strong><span class="from-peer">via mpai</span><time>09:17</time></header>',
      '<p>Keep the provider payload adapter outside the domain package. I’m reviewing the diff from here.</p>',
      '</article>',
      '<article class="system-turn"><i></i><span>Maya and Alex are following the same native session</span></article>'
    ].join("")
  }
];

const transcript = document.querySelector("[data-demo-transcript]");
const demoTitle = document.querySelector("[data-demo-title]");
const providerLabel = document.querySelector(".demo-provider");
const sessionButtons = [...document.querySelectorAll("[data-demo-session]")];

const productHuntLaunchAt = Date.parse("2026-08-03T07:01:00Z");
const launchBanner = document.querySelector("[data-launch-banner]");

function refreshLaunchBanner() {
  if (!launchBanner || Date.now() < productHuntLaunchAt) return;
  launchBanner.querySelector("[data-launch-status]").textContent = "mpai is live now on Product Hunt";
  launchBanner.querySelector("[data-launch-action]").textContent = "Support the launch ↗";
  launchBanner.classList.add("is-live");
}

refreshLaunchBanner();
if (Date.now() < productHuntLaunchAt) {
  window.setTimeout(refreshLaunchBanner, productHuntLaunchAt - Date.now());
}

function selectSession(index) {
  const session = demoSessions[index];
  if (!session || !transcript) return;

  sessionButtons.forEach((button, buttonIndex) => {
    const selected = buttonIndex === index;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  transcript.classList.add("changing");
  window.setTimeout(() => {
    providerLabel.textContent = session.provider;
    demoTitle.textContent = session.title;
    transcript.innerHTML = session.turns;
    transcript.classList.remove("changing");
  }, 130);
}

sessionButtons.forEach((button, index) => {
  button.addEventListener("click", () => selectSession(index));
});

const toast = document.querySelector(".copy-toast");
let toastTimeout;

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "copied";
      toast.classList.add("visible");
      window.clearTimeout(toastTimeout);
      toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 1800);
      window.setTimeout(() => { button.textContent = "copy"; }, 1500);
    } catch {
      const code = button.closest(".command-row")?.querySelector("code");
      if (code) window.getSelection()?.selectAllChildren(code);
    }
  });
});

async function loadStars() {
  try {
    const response = await fetch("https://api.github.com/repos/godfaddaai/multiplayer-ai", {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) return;
    const repository = await response.json();
    document.querySelectorAll("[data-star-count]").forEach((count) => {
      count.textContent = new Intl.NumberFormat("en", { notation: "compact" }).format(repository.stargazers_count);
      count.hidden = false;
    });
  } catch {
    // The page remains fully usable if GitHub's public API is unavailable.
  }
}

loadStars();
