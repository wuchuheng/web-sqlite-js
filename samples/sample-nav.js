/**
 * SampleNav Web Component
 * A reusable navigation component for sample pages with iframe-based page switching
 */
class SampleNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.injectGlobalStyles();
    this.render();
    this.initEventListeners();
  }

  injectGlobalStyles() {
    // Check if global styles are already injected
    if (document.querySelector("#sample-nav-global-styles")) return;

    const style = document.createElement("style");
    style.id = "sample-nav-global-styles";
    style.textContent = `
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  static get observedAttributes() {
    return [
      "title",
      "badge",
      "pages",
      "default-page",
      "bypass-cache",
      "versions",
    ];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
      this.initEventListeners();
    }
  }

  getTitle() {
    return this.getAttribute("title") || "web-sqlite-js Examples";
  }

  getBadge() {
    return this.getAttribute("badge") || "";
  }

  getPages() {
    const pagesAttr = this.getAttribute("pages");
    if (!pagesAttr) return [];

    try {
      return JSON.parse(pagesAttr);
    } catch {
      return [];
    }
  }

  getDefaultPage() {
    return this.getAttribute("default-page") || this.getPages()[0]?.page || "";
  }

  getVersions() {
    const versionsAttr = this.getAttribute("versions");
    if (!versionsAttr) return [];

    try {
      return JSON.parse(versionsAttr);
    } catch {
      return [];
    }
  }

  render() {
    const title = this.getTitle();
    const badge = this.getBadge();
    const pages = this.getPages();
    const defaultPage = this.getDefaultPage();
    const versions = this.getVersions();

    this.shadowRoot.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #f5f5f5;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        header {
          background: #4285f4;
          color: white;
          padding: 20px 30px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        header h1 {
          font-size: 24px;
          margin-bottom: 5px;
        }

        header p {
          opacity: 0.9;
          font-size: 14px;
        }

        .badge {
          display: inline-block;
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          margin-left: 10px;
        }

        .version-switcher {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .version-link {
          background: rgba(255, 255, 255, 0.15);
          color: white;
          text-decoration: none;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          transition: background 0.2s;
        }

        .version-link:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .version-link.active {
          background: rgba(255, 255, 255, 0.4);
          font-weight: 600;
        }

        .container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .sidebar {
          width: 280px;
          background: white;
          border-right: 1px solid #e0e0e0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
        }

        .sidebar-header h2 {
          font-size: 14px;
          text-transform: uppercase;
          color: #666;
          letter-spacing: 1px;
        }

        .nav-menu {
          padding: 10px 0;
        }

        .nav-item {
          padding: 12px 20px;
          cursor: pointer;
          border-left: 3px solid transparent;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-item:hover {
          background: #f0f4ff;
        }

        .nav-item.active {
          background: #e8f0fe;
          border-left-color: #4285f4;
        }

        .nav-icon {
          width: 32px;
          height: 32px;
          background: #e8f0fe;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .nav-item.active .nav-icon {
          background: #4285f4;
          color: white;
        }

        .nav-text {
          flex: 1;
        }

        .nav-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
        }

        .nav-item.active .nav-title {
          color: #1967d2;
        }

        .nav-desc {
          font-size: 12px;
          color: #666;
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .toolbar {
          background: white;
          padding: 12px 20px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .current-page {
          font-weight: 600;
          color: #333;
        }

        .open-new-tab {
          padding: 8px 16px;
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .open-new-tab:hover {
          background: #3367d6;
        }

        .refresh-btn {
          padding: 8px 16px;
          background: #4285f4;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .refresh-btn:hover {
          background: #3367d6;
        }

        .iframe-container {
          flex: 1;
          background: #fff;
          overflow: hidden;
        }

        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }

        .footer {
          background: white;
          padding: 10px 20px;
          border-top: 1px solid #e0e0e0;
          font-size: 12px;
          color: #666;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer a {
          color: #4285f4;
          text-decoration: none;
        }

        .footer a:hover {
          text-decoration: underline;
        }
      </style>

      <header>
        <h1>${title} ${badge ? `<span class="badge">${badge}</span>` : ""}</h1>
        <p>Explore web-sqlite-js through interactive examples</p>
        ${
          versions.length > 0
            ? `
          <div class="version-switcher">
            ${versions
              .map(
                (v) => `
              <a href="${v.href}" class="version-link ${v.active ? "active" : ""}">${v.label}</a>
            `,
              )
              .join("")}
          </div>
        `
            : ""
        }
      </header>

      <div class="container">
        <div class="sidebar">
          <div class="sidebar-header">
            <h2>Examples</h2>
          </div>
          <div class="nav-menu">
            ${pages
              .map(
                (page, index) => `
              <div class="nav-item ${index === 0 ? "active" : ""}" data-page="${page.page}" data-title="${page.title}">
                <div class="nav-icon">${page.icon || "📄"}</div>
                <div class="nav-text">
                  <div class="nav-title">${page.title}</div>
                  <div class="nav-desc">${page.desc || ""}</div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <div class="content">
          <div class="toolbar">
            <div class="toolbar-left">
              <span class="current-page">${pages[0]?.title || ""}</span>
            </div>
            <div class="toolbar-right">
              <button class="refresh-btn" id="refreshBtn" title="Refresh current page">
                <span>↻</span> Refresh
              </button>
              <a href="./${defaultPage}" class="open-new-tab" target="_blank">
                <span>↗</span> Open in New Tab
              </a>
            </div>
          </div>
          <div class="iframe-container">
            <iframe src="./${defaultPage}" title="Example Content" id="contentFrame"></iframe>
          </div>
        </div>
      </div>

      <div class="footer">
        <span>web-sqlite-js • Examples</span>
        <span>
          <a href="https://web-sqlite-js.wuchuheng.com" target="_blank">Documentation</a>
          •
          <a href="https://github.com/wuchuheng/web-sqlite-js" target="_blank">GitHub</a>
        </span>
      </div>
    `;
  }

  initEventListeners() {
    const navItems = this.shadowRoot.querySelectorAll(".nav-item");
    const iframe = this.shadowRoot.querySelector("#contentFrame");
    const currentPageTitle = this.shadowRoot.querySelector(".current-page");
    const openNewTabBtn = this.shadowRoot.querySelector(".open-new-tab");
    const refreshBtn = this.shadowRoot.querySelector("#refreshBtn");
    const pages = this.getPages();
    const bypassCache = this.getAttribute("bypass-cache") === "true";

    // Function to load a page
    const loadPage = (pageName) => {
      const matchingPage = pages.find((p) => p.page === pageName);
      if (!matchingPage) return;

      const page = `./${pageName}`;
      iframe.src = page;
      currentPageTitle.textContent = matchingPage.title;
      openNewTabBtn.href = page;

      // Update active state
      navItems.forEach((nav) => {
        if (nav.dataset.page === pageName) {
          nav.classList.add("active");
        } else {
          nav.classList.remove("active");
        }
      });

      // Update hash
      window.location.hash = pageName;
    };

    // Initialize from hash or default page
    const initFromHash = () => {
      const hash = window.location.hash.slice(1); // Remove #
      if (hash && pages.some((p) => p.page === hash)) {
        loadPage(hash);
      } else {
        loadPage(this.getDefaultPage());
      }
    };

    // Handle hash changes
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.slice(1);
      if (hash && pages.some((p) => p.page === hash)) {
        loadPage(hash);
      }
    });

    // Initialize on load
    initFromHash();

    // Nav item clicks
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        loadPage(item.dataset.page);

        // Bypass iframe cache if enabled
        if (bypassCache && iframe.contentWindow) {
          iframe.contentWindow.location.reload(true);
        }
      });
    });

    // Refresh button
    refreshBtn.addEventListener("click", () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.location.reload(true);
      }
    });

    // Handle iframe navigation
    iframe.addEventListener("load", () => {
      try {
        const iframePath = new URL(iframe.src).pathname;
        const pageName = iframePath.split("/").pop();
        if (pageName && pageName !== "index.html") {
          const matchingPage = pages.find((p) => p.page === pageName);
          if (matchingPage) {
            currentPageTitle.textContent = matchingPage.title;
            openNewTabBtn.href = `./${pageName}`;

            // Update active state
            navItems.forEach((nav) => {
              if (nav.dataset.page === pageName) {
                nav.classList.add("active");
              } else {
                nav.classList.remove("active");
              }
            });

            // Update hash if different
            if (window.location.hash.slice(1) !== pageName) {
              window.location.hash = pageName;
            }
          }
        }
      } catch (e) {
        // Ignore cross-origin or other URL errors
      }
    });
  }
}

customElements.define("sample-nav", SampleNav);
