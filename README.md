# E-Hentai/ExHentai Waterfall Viewer

**English** | [ **简体中文** ](./README_zh-CN.md)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Language](https://img.shields.io/badge/language-JavaScript-yellow.svg) ![Compatible](https://img.shields.io/badge/compatible-Tampermonkey-brightgreen.svg)

> High-performance UserScript for seamless gallery browsing

---

## ✨ Key Features

*   **🌊 Fluid Scrolling**: View entire galleries without page breaks
*   **⚡️ Performance Optimized**:
    *   **Request Pool (4 max)**: Prevents server overload and IP bans
    *   **Lazy Loading**: Images load only when visible
    *   **Smart Caching**: Speeds up navigation
*   **🎨 Adaptive UI**:
    *   **Theme Support**: Auto-detects light/dark themes
    *   **Dual Navigation**: Control panel + quick access toolbar
*   **⚙️ Customization**:
    *   **Width Adjustment**: 100-2000px range (default: 800px)
    *   **Original Images**: Load HD versions (login required)
*   **🧠 Memory Management**: Automatic resource cleanup

## 📦 Installation

1.  **Install UserScript Manager**  
    Requires [Tampermonkey](https://www.tampermonkey.net/) or compatible

2.  **Install Script**  
    Click below (manager will prompt confirmation):

    ➡️ [Install Now](https://YOUR_SCRIPT_INSTALL_LINK_HERE) ⬅️

## 🛠️ Usage

On any gallery page (e.g. `https://e-hentai.org/g/xxxx/yyyyyy/`), the control panel appears **below** the thumbnail section.

![Screenshot](https://github.com/khongphaitaianh/E-Hentai-Waterfall-Viewer/blob/main/Pic/image.png)

1.  **Basic Controls**:
    - Range: Set start/end positions
    - Width: Adjust display width (px)
    - Original: Toggle HD images (requires login)

2.  **Navigation**:
    - `<<<`: Load previous batch
    - `>>>`: Load next batch
    - Bottom toolbar: Quick access

3.  **Pro Tips**:
    - Right-click images to force reload
    - Auto-layout on zoom
    - Settings auto-save to cookies

## 🤝 Contributing

Ways to contribute:
- Report issues: [Issue Tracker](https://github.com/your-repo/issues)
- Submit PRs
- Improve translations

## 📜 License

Licensed under the [MIT License](LICENSE)
