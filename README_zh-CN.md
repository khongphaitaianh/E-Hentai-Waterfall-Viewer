# E-Hentai/ExHentai 瀑布流查看器

[ **English** ](./README.md) | **简体中文**

![许可证](https://img.shields.io/badge/license-MIT-blue.svg) ![语言](https://img.shields.io/badge/language-JavaScript-yellow.svg) ![兼容性](https://img.shields.io/badge/compatible-Tampermonkey-brightgreen.svg)

> 一款高性能油猴脚本，为 E-Hentai/ExHentai 提供流畅的瀑布流（无限滚动）看图体验

---

## ✨ 主要特性

* **🌊 真正的瀑布流体验**：告别翻页，在单页中流畅浏览整个图集
* **⚡️ 高性能引擎**：
    * **请求池控制**：智能限制并发请求数（最多4个），避免服务器过载和IP封禁
    * **懒加载技术**：仅加载可视区域内的图片，节省带宽和内存
    * **智能缓存系统**：缓存DOM元素和图片数据，提升二次加载速度
* **🎨 自适应界面**：
    * **主题适配**：自动匹配E-Hentai（亮色）和ExHentai（暗色）主题
    * **双导航栏设计**：顶部控制面板 + 底部快捷导航栏
* **⚙️ 高度可定制**：
    * **宽度调节**：自由设置图片显示宽度（默认800px，范围100-2000px）
    * **原图加载**：支持加载高清原图（需登录且有权限）
* **🧠 内存管理**：自动清理非活跃图片，优化长期浏览体验

## 📦 安装指南

1. **安装脚本管理器**
    需先安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)（推荐）或 Violentmonkey
2. **安装脚本**
    点击下方链接安装（脚本管理器会弹出确认窗口）：
    
    ➡️ [点击此处安装](https://YOUR_SCRIPT_INSTALL_LINK_HERE) ⬅️

## 🛠️ 使用说明

访问任意E-Hentai/ExHentai图集页面（如`https://e-hentai.org/g/xxxx/yyyyyy/`），控制面板将出现在缩略图区域**下方**。

![界面截图](https://github.com/khongphaitaianh/E-Hentai-Waterfall-Viewer/blob/main/Pic/image.png)

1. **基本控制**：
    
    - 起始/结束位置：设置要加载的图片范围
    - 图片宽度：调节显示宽度（单位像素）
    - 原图模式：勾选后加载高清原图（需登录）
2. **导航功能**：
    
    - `<<<` 按钮：加载当前范围之前的图片
    - `>>>` 按钮：加载当前范围之后的图片
    - 底部固定导航栏：方便快速操作
3. **高级技巧**：
    
    - 右键点击图片可强制重新加载
    - 页面缩放时自动调整布局
    - 所有设置会自动保存到Cookies

## 🤝 参与贡献

欢迎通过以下方式参与改进：

- 报告问题：[问题追踪页](https://github.com/khongphaitaianh/E-Hentai-Waterfall-Viewer/issues)
- 提交Pull Request
- 翻译改进

## 📜 许可证

本项目采用 [MIT许可证](LICENSE)

