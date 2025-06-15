// ==UserScript==
// @name         E-Hentai/ExHentai Waterfall Viewer
// @name:zh-CN   E-Hentai/ExHentai 瀑布流查看器
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Performance optimized version with request pooling, lazy loading, and DOM caching
// @description:zh-CN 性能优化版本，包含请求池、懒加载和DOM缓存等优化
// @author       Original Panda Script (Modified & Optimized)
// @match        https://e-hentai.org/g/*/*
// @match        https://exhentai.org/g/*/*
// @icon         https://exhentai.org/favicon.ico
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. 配置与全局变量 ---
    var lang_zh = (navigator.language && navigator.language.toLowerCase() === 'zh-cn');
    var LANG = {
        error_retry: lang_zh ? '网络错误，是否重试？' : 'Network error, retry?',
        range: lang_zh ? '范围' : 'Range',
        width: lang_zh ? '宽度' : 'Width',
        original: lang_zh ? '原图' : 'Original',
        load_how_many: lang_zh ? '加载多少张图片？（留空读取至末尾）' : 'How many pictures to load? (Leave blank to end)',
        input_error: lang_zh ? '输入有误' : 'Incorrect input',
        edge_reached: lang_zh ? '到达边界' : 'Edge reached',
        original_warning: lang_zh ? '请确认已登录且有权限，否则无法加载原图。' : 'If you are not logged in or lack permission, original pictures will not display.',
        loading: lang_zh ? '加载中...' : 'Loading...',
        load_button: lang_zh ? '开始加载' : 'Start Loading',
        back_to_top: lang_zh ? '回到顶部' : 'Back to Top',
    };

    var config_width = parseInt(getCookie('panda_waterfall_width')) || 800;
    var config_load_original = getCookie('panda_waterfall_original') === 'true';
    var galleryId = window.gid;
    var galleryToken = window.token;
    const IMAGES_PER_PAGE = 40;
    const isDarkTheme = document.domain.includes('exhentai');
    let initialWrapperWidth = '1180px';

    // 性能优化相关配置
    const MAX_CONCURRENT_REQUESTS = 4; // 最大并发请求数
    const LAZY_LOAD_THRESHOLD = 200; // 懒加载阈值
    const MAX_VISIBLE_IMAGES = 50; // 最大可见图片数量

    // 缓存和状态管理
    const domCache = {}; // DOM元素缓存
    const imageCache = new Map(); // 图片信息缓存
    const requestQueue = []; // 请求队列
    let activeRequests = 0; // 当前活跃请求数
    let intersectionObserver = null; // 懒加载观察器

    if (!galleryId || !galleryToken) return;

    // --- 1. 辅助函数 ---
    function setCookie(name, value) {
        document.cookie = name + '=' + value + ';path=/;domain=.' + document.domain + ';max-age=31536000';
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // DOM缓存函数
    function getElement(id) {
        if (!domCache[id]) {
            domCache[id] = document.getElementById(id);
        }
        return domCache[id];
    }

    // 清理DOM缓存
    function clearDomCache() {
        Object.keys(domCache).forEach(key => {
            if (!document.getElementById(key)) {
                delete domCache[key];
            }
        });
    }

    // --- 2. 请求池管理 ---
    class RequestPool {
        constructor(maxConcurrent = MAX_CONCURRENT_REQUESTS) {
            this.maxConcurrent = maxConcurrent;
            this.activeRequests = 0;
            this.queue = [];
        }

        async request(requestFn) {
            return new Promise((resolve, reject) => {
                this.queue.push({ requestFn, resolve, reject });
                this.processQueue();
            });
        }

        async processQueue() {
            if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
                return;
            }

            const { requestFn, resolve, reject } = this.queue.shift();
            this.activeRequests++;

            try {
                const result = await requestFn();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.activeRequests--;
                this.processQueue();
            }
        }
    }

    const requestPool = new RequestPool();

    // --- 3. AJAX数据获取函数 ---
    function loadGalleryPage(pageNum) {
        const cacheKey = `page_${pageNum}`;
        if (imageCache.has(cacheKey)) {
            return Promise.resolve(imageCache.get(cacheKey));
        }

        return requestPool.request(() => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const url = 'https://' + document.domain + '/g/' + galleryId + '/' + galleryToken + '/?p=' + (pageNum - 1) + '&inline_set=ts_m';

                xhr.open('GET', url, true);
                xhr.timeout = 10000; // 10秒超时

                xhr.onreadystatechange = function() {
                    if (this.readyState === 4) {
                        if (this.status === 200) {
                            const hashInfo = {};
                            const text = this.responseText;
                            const regex = /https:\/\/e[x|-]hentai\.org\/s\/([a-f0-9]+)\/(\d+)-(\d+)/g;
                            let match, seen = {};

                            while ((match = regex.exec(text)) !== null) {
                                const hash = match[1], imgNum = match[3];
                                if (!seen[imgNum]) {
                                    hashInfo[imgNum] = hash;
                                    seen[imgNum] = true;
                                }
                            }

                            imageCache.set(cacheKey, hashInfo);
                            resolve(hashInfo);
                        } else {
                            reject(new Error(`HTTP ${this.status}`));
                        }
                    }
                };

                xhr.ontimeout = () => reject(new Error('Timeout'));
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(null);
            });
        });
    }

    function loadImageFile(imgNum, hash, adds) {
        const cacheKey = `img_${imgNum}_${hash}_${adds}`;
        if (imageCache.has(cacheKey)) {
            return Promise.resolve(imageCache.get(cacheKey));
        }

        return requestPool.request(() => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const url = 'https://' + document.domain + '/s/' + hash + '/' + galleryId + '-' + imgNum + '?' + adds;

                xhr.open('GET', url, true);
                xhr.timeout = 15000; // 15秒超时

                xhr.onreadystatechange = function() {
                    if (this.readyState === 4) {
                        if (this.status === 200) {
                            const html = this.responseText;
                            const info = { numb: imgNum, hash: hash, show: '', full: '', adds: adds };

                            const showMatch = html.match(/id="img" src="(.*?)"/);
                            info.show = showMatch ? showMatch[1] : '';

                            const fullMatch = html.match(/href="(https:\/\/e[x|-]hentai.org\/fullimg.php(.*?))"/);
                            info.full = (fullMatch && fullMatch[1]) ? fullMatch[1].replace(/&/g, '&') : info.show;

                            const nlMatch = html.match(/nl\(\'([^\']+)\'\)/);
                            if (nlMatch && nlMatch[1]) info.adds = 'nl=' + nlMatch[1];

                            imageCache.set(cacheKey, info);
                            resolve(info);
                        } else {
                            reject(new Error(`HTTP ${this.status}`));
                        }
                    }
                };

                xhr.ontimeout = () => reject(new Error('Timeout'));
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(null);
            });
        });
    }

    // --- 4. 懒加载实现 ---
    function initLazyLoading() {
        if (intersectionObserver) {
            intersectionObserver.disconnect();
        }

        intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.lazy === 'true') {
                        loadImageLazy(img);
                        intersectionObserver.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: `${LAZY_LOAD_THRESHOLD}px`
        });
    }

    async function loadImageLazy(imgElement) {
        const imgNum = imgElement.dataset.imgNum;
        const hash = imgElement.dataset.hash;
        const adds = imgElement.dataset.adds || '';

        try {
            const info = await loadImageFile(imgNum, hash, adds);

            if (info && info.show) {
                imgElement.dataset.adds = info.adds;
                imgElement.src = config_load_original ? info.full : info.show;
                imgElement.classList.add('panda_image_loaded');
                imgElement.classList.remove('panda_image_placeholder');
                imgElement.alt = "Image " + imgNum + ". Click to reload if broken.";
                imgElement.onclick = () => reloadImage(imgElement, info);
                imgElement.dataset.lazy = 'false';

                imgElement.style.width = config_width + 'px';
            } else {
                throw new Error('No image data');
            }
        } catch (error) {
            imgElement.classList.add('panda_image_failed');
            imgElement.alt = "Failed to load. Click to retry.";
            imgElement.onclick = () => {
                imgElement.classList.remove('panda_image_failed');
                imgElement.dataset.lazy = 'true';
                loadImageLazy(imgElement);
            };
        }
    }

    function reloadImage(imgElement, info) {
        imgElement.classList.remove('panda_image_loaded');
        imgElement.classList.add('panda_image_placeholder');
        imgElement.dataset.lazy = 'true';
        loadImageLazy(imgElement);
    }

    // --- 5. UI 逻辑函数 ---
    function setStatus(message, timeout = 0) {
        const statusText = getElement('panda_status');
        if (!statusText) return;
        statusText.textContent = message;
        if (timeout > 0) {
            setTimeout(() => {
                if (statusText.textContent === message) statusText.textContent = '';
            }, timeout);
        }
    }

    async function showImageList() {
        setStatus(LANG.loading);

        const fileFrom = parseInt(getElement('panda_filefrom').value);
        const fileTo = parseInt(getElement('panda_filefinl').value);
        const totalFiles = parseInt(getElement('panda_fileqnty').title);

        if (!fileFrom || fileFrom < 1 || !fileTo || fileTo > totalFiles || fileFrom > fileTo) {
            alert(LANG.input_error);
            setStatus('');
            return;
        }

        getElement('panda_filefrom').title = fileFrom;
        getElement('panda_filefinl').title = fileTo;

        // 确保容器宽度能够容纳设定的图片宽度
        const wrapper = getElement('panda_wrapper');
        if (wrapper) {
            const baseAlignmentWidth = parseInt(initialWrapperWidth) || 1180;
            // 计算需要的最小wrapper宽度
            const requiredWrapperWidth = config_width + 32;

            // 始终使用较大的宽度，确保容器能容纳内容
            const finalWrapperWidth = Math.max(baseAlignmentWidth, requiredWrapperWidth);
            wrapper.style.width = finalWrapperWidth + 'px';
        }

        // 更新动态样式
        updateImageStyles();

        const pageFrom = Math.ceil(fileFrom / IMAGES_PER_PAGE);
        const pageTo = Math.ceil(fileTo / IMAGES_PER_PAGE);

        try {
            // 并行加载所有页面
            const pagePromises = [];
            for (let p = pageFrom; p <= pageTo; p++) {
                pagePromises.push(loadGalleryPage(p));
            }

            const pageResults = await Promise.all(pagePromises);
            const allHashes = Object.assign({}, ...pageResults);

            setStatus('');

            // 使用DocumentFragment批量插入DOM
            const list = getElement('panda_list');
            const fragment = document.createDocumentFragment();
            list.innerHTML = '';

            // 显示导航按钮
            getElement('panda_prev').style.display = 'inline';
            getElement('panda_next').style.display = 'inline';
            getElement('panda_dock').style.display = 'block';

            // 批量创建图片元素
            for (let i = fileFrom; i <= fileTo; i++) {
                if (allHashes[i]) {
                    const img = document.createElement('img');
                    img.id = 'panda_file_' + i;
                    img.alt = "Loading Image " + i;
                    img.className = 'panda_image_placeholder';
                    img.dataset.imgNum = i;
                    img.dataset.hash = allHashes[i];
                    img.dataset.lazy = 'true';

                    // 设置图片宽度
                    img.style.width = config_width + 'px';

                    fragment.appendChild(img);
                }
            }

            list.appendChild(fragment);

            // 初始化懒加载
            initLazyLoading();

            // 将所有图片添加到懒加载观察器
            const images = list.querySelectorAll('img[data-lazy="true"]');
            images.forEach(img => intersectionObserver.observe(img));

            getElement('panda_plus').scrollIntoView({behavior: "smooth"});

        } catch (error) {
            console.error('Error loading images:', error);
            setStatus('加载失败: ' + error.message, 5000);
        }
    }

    function navigate(direction) {
        const totalFiles = parseInt(getElement('panda_fileqnty').title);
        const currentFrom = parseInt(getElement('panda_filefrom').title) || parseInt(getElement('panda_filefrom').value);
        const currentTo = parseInt(getElement('panda_filefinl').title) || parseInt(getElement('panda_filefinl').value);

        if ((direction === 'prev' && currentFrom <= 1) || (direction !== 'prev' && currentTo >= totalFiles)) {
            alert(LANG.edge_reached);
            return;
        }

        const loadCount = prompt(LANG.load_how_many, currentTo - currentFrom + 1);
        if (loadCount === null) return;

        const count = loadCount === '' ? totalFiles : parseInt(loadCount);
        if (!count || count <= 0) return;

        let newFrom, newTo;
        if (direction === 'prev') {
            newTo = currentFrom - 1;
            newFrom = Math.max(1, currentFrom - count);
        } else {
            newFrom = currentTo + 1;
            newTo = Math.min(totalFiles, currentTo + count);
        }

        getElement('panda_filefrom').value = newFrom;
        getElement('panda_filefinl').value = newTo;
        showImageList();
    }

    // --- 6. UI 注入和样式设置 ---
    function injectCSS() {
        const colors = isDarkTheme ? {
            wrapperBg: '#34353B', wrapperBorder: '#4F535B', textColor: '#F1F1F1',
            inputBg: '#4F535B', inputBorder: '#666666', buttonBg: '#43464E',
            buttonHover: '#555A60', linkColor: '#B1B1B1', accentColor: '#ED575A',
        } : {
            wrapperBg: '#F2F0E4', wrapperBorder: '#B5A495', textColor: '#000000',
            inputBg: '#FFFFFF', inputBorder: '#A09488', buttonBg: '#E3E0D1',
            buttonHover: '#D1C4B5', linkColor: '#5C0D11', accentColor: '#900',
        };

        const styles = `
            #panda_wrapper {
                border: 1px solid ${colors.wrapperBorder};
                background-color: ${colors.wrapperBg};
                color: ${colors.textColor};
                width: ${initialWrapperWidth};
                margin: 0 auto;
                clear: both;
                padding: 15px;
                border-radius: 9px;
                box-shadow: 0px 2px 8px rgba(0,0,0,0.2);
                text-align: center;
                box-sizing: border-box;
                margin-top: 20px;
                margin-bottom: 20px;
            }
            #panda_plus, #panda_dock { padding: 10px 0; margin: 0; }
            #panda_wrapper h3 { margin: 12px 0; font-size: 1.1em; }
            #panda_plus input[type=text], #panda_plus input[type=number] {
                padding: 5px 8px; border: 1px solid ${colors.inputBorder}; border-radius: 3px;
                background-color: ${colors.inputBg}; color: ${colors.textColor};
                width: 60px; text-align: center; margin: 0 5px;
            }
            #panda_plus label { cursor: pointer; }
            #panda_list {
                margin: 20px auto; padding: 15px 0;
                border-top: 1px solid ${colors.inputBorder};
                border-bottom: 1px solid ${colors.inputBorder};
                width: ${config_width}px;
            }
            .panda_image_placeholder {
                display: block; margin: 15px auto;
                width: ${config_width}px; min-height: 150px;
                background-color: ${isDarkTheme ? '#4F535B' : '#E3E0D1'};
                border: 1px solid ${colors.inputBorder};
                transition: all 0.3s ease;
                opacity: 0.7;
            }
            .panda_image_loaded {
                background-color: transparent;
                border: none;
                opacity: 1;
                transition: opacity 0.3s ease;
                width: ${config_width}px;
            }
            .panda_image_failed {
                background-color: ${colors.accentColor} !important;
                opacity: 0.8;
            }
            .panda_btn {
                display: inline-block; padding: 8px 20px; margin: 5px 15px;
                border: 1px solid ${colors.inputBorder}; border-radius: 4px;
                background-color: ${colors.buttonBg}; text-decoration: none;
                font-weight: bold; color: ${colors.textColor};
                transition: background-color 0.3s; cursor: pointer;
            }
            .panda_btn:hover { background-color: ${colors.buttonHover}; }
            .panda_nav, #panda_wrapper a {
                text-decoration: none; font-weight: bold; color: ${colors.linkColor};
                margin: 0 10px; display: inline-block;
            }
            .panda_nav:hover, #panda_wrapper a:hover { text-decoration: underline; }
            #panda_status {
                color: ${colors.accentColor}; font-weight: bold;
                font-size: 0.9em; display: block; margin-top: 8px;
            }
        `;
        addStyle(styles);
    }

    // 动态更新图片样式
    function updateImageStyles() {
        // 移除旧的动态样式
        const oldStyle = document.getElementById('panda_dynamic_styles');
        if (oldStyle) {
            oldStyle.remove();
        }

        // 只更新图片相关样式，wrapper宽度通过内联样式处理
        const dynamicStyles = `
            #panda_list {
                width: ${config_width}px !important;
            }
            .panda_image_placeholder {
                width: ${config_width}px !important;
            }
            .panda_image_loaded {
                width: ${config_width}px !important;
            }
        `;

        const style = document.createElement('style');
        style.id = 'panda_dynamic_styles';
        style.textContent = dynamicStyles;
        document.head.appendChild(style);
    }

    function injectUI() {
        if (getElement('panda_wrapper')) return;

        // 动态获取对齐宽度
        const gdtElement = document.getElementById('gdt');
        const cdivElement = document.getElementById('cdiv');
        const targetWidthElement = gdtElement || cdivElement;

        if (targetWidthElement) {
            initialWrapperWidth = targetWidthElement.offsetWidth + 'px';
        } else {
            initialWrapperWidth = '1180px'; // 修改默认值为更合理的1180px
        }

        // 解析页面信息
        const gpcElements = document.querySelectorAll('.gpc');
        let naviText = "";
        for (let el of gpcElements) {
            if (!el.hidden) {
                naviText = el.textContent;
                break;
            }
        }
        if (!naviText && gpcElements.length > 0) naviText = gpcElements[0].textContent;

        const matchGlobal = naviText.match(/(?:Showing\s*)?([\d,]+)\s*-\s*([\d,]+)(?:\s*of|，\s*共)\s*([\d,]+)\s*(?:images|张)/i);
        const matchTotalOnly = naviText.match(/(?:共|of)\s*([\d,]+)\s*(?:images|张)/i);

        let navi;
        if (matchGlobal) {
            navi = [matchGlobal[0], matchGlobal[1], matchGlobal[2], matchGlobal[3]];
        } else if (matchTotalOnly) {
            navi = [matchTotalOnly[0], undefined, undefined, matchTotalOnly[1]];
        }

        if (!navi) {
            console.error("Waterfall Script: 无法解析图片总数信息。");
            return;
        }

        const totalImages = navi[3] ? navi[3].replace(/,/g, '') : 0;
        const currentFrom = navi[1] ? navi[1].replace(/,/g, '') : 1;

        injectCSS();

        // 创建UI容器
        const uiContainer = document.createElement('div');
        uiContainer.id = 'panda_wrapper';
        uiContainer.innerHTML = `
            <div id="panda_plus">
                <h3>
                    ${LANG.range}:
                    <input id="panda_filefrom" type="number" value="${currentFrom}" title="${currentFrom}" />
                    <span id="panda_fileqnty" title="${totalImages}">-</span>
                    <input id="panda_filefinl" type="number" value="${totalImages}" title="${totalImages}" />
                      |
                    ${LANG.width}:
                    <input id="panda_size" type="number" value="${config_width}" /> px
                      |
                    <label>${LANG.original}: <input type="checkbox" id="panda_original_toggle" ${config_load_original ? 'checked' : ''} /></label>
                </h3>
                <h3>
                    <a id="panda_prev" href="javascript:void(0);" class="panda_nav" style="display:none;"><<<</a>
                    <a id="panda_load_btn" href="javascript:void(0);" class="panda_btn">▼ ${LANG.load_button}</a>
                    <a id="panda_next" href="javascript:void(0);" class="panda_nav" style="display:none;">>>></a>
                </h3>
                <div id="panda_status"></div>
            </div>
            <div id="panda_list"></div>
            <div id="panda_dock" style="display:none;">
                <h3>
                    <a id="panda_dock_prev" href="javascript:void(0);" class="panda_nav"><<<</a>
                    <a href="#panda_plus" class="panda_btn">▲ ${LANG.back_to_top}</a>
                    <a id="panda_dock_next" href="javascript:void(0);" class="panda_nav">>>></a>
                </h3>
            </div>
        `;

        // 插入UI
        const insertPoint = document.getElementById('cdiv') ||
                           document.querySelector('.gtb') ||
                           document.getElementById('gdt');

        if (insertPoint) {
            if (insertPoint.id === 'cdiv') {
                insertPoint.parentNode.insertBefore(uiContainer, insertPoint);
            } else {
                insertPoint.parentNode.insertBefore(uiContainer, insertPoint.nextSibling);
            }
        } else {
            document.body.appendChild(uiContainer);
        }

        // 缓存新创建的DOM元素
        domCache['panda_wrapper'] = uiContainer;
        domCache['panda_load_btn'] = uiContainer.querySelector('#panda_load_btn');
        domCache['panda_prev'] = uiContainer.querySelector('#panda_prev');
        domCache['panda_next'] = uiContainer.querySelector('#panda_next');
        domCache['panda_dock_prev'] = uiContainer.querySelector('#panda_dock_prev');
        domCache['panda_dock_next'] = uiContainer.querySelector('#panda_dock_next');
        domCache['panda_size'] = uiContainer.querySelector('#panda_size');
        domCache['panda_original_toggle'] = uiContainer.querySelector('#panda_original_toggle');

        // 立即设置正确的wrapper宽度，确保首次加载时就能适应用户设置的宽度
        const baseAlignmentWidth = parseInt(initialWrapperWidth) || 1180;
        const requiredWrapperWidth = config_width + 32;
        const finalWrapperWidth = Math.max(baseAlignmentWidth, requiredWrapperWidth);
        uiContainer.style.width = finalWrapperWidth + 'px';

        // 初始化样式（如果需要的话）
        if (config_width !== 800) {
            updateImageStyles();
        }

        // 绑定事件
        getElement('panda_load_btn').addEventListener('click', showImageList);
        getElement('panda_prev').addEventListener('click', () => navigate('prev'));
        getElement('panda_next').addEventListener('click', () => navigate('next'));
        getElement('panda_dock_prev').addEventListener('click', () => navigate('prev'));
        getElement('panda_dock_next').addEventListener('click', () => navigate('next'));

        getElement('panda_size').addEventListener('change', function() {
            config_width = parseInt(this.value) > 100 ? parseInt(this.value) : 800;
            this.value = config_width;
            setCookie('panda_waterfall_width', config_width);

            // 更新wrapper宽度
            const wrapper = getElement('panda_wrapper');
            if (wrapper) {
                const baseAlignmentWidth = parseInt(initialWrapperWidth) || 1180;
                // 计算需要的最小wrapper宽度
                const requiredWrapperWidth = config_width + 32;

                // 始终使用较大的宽度，确保容器能容纳内容
                const finalWrapperWidth = Math.max(baseAlignmentWidth, requiredWrapperWidth);
                wrapper.style.width = finalWrapperWidth + 'px';
            }

            // 更新所有现有图片的内联样式
            const images = document.querySelectorAll('#panda_list img');
            images.forEach(img => {
                img.style.width = config_width + 'px';
            });

            // 更新CSS样式
            updateImageStyles();
        });

        getElement('panda_original_toggle').addEventListener('change', function() {
            config_load_original = this.checked;
            setCookie('panda_waterfall_original', config_load_original);
            if (this.checked && document.domain.includes('e-hentai')) {
                alert(LANG.original_warning);
            }
            if (getElement('panda_list').innerHTML !== '') {
                showImageList();
            }
        });
    }

    // --- 7. 内存管理 ---
    function cleanupMemory() {
        // 清理DOM缓存
        clearDomCache();

        // 限制图片缓存大小
        if (imageCache.size > 200) {
            const entries = Array.from(imageCache.entries());
            const toDelete = entries.slice(0, entries.length - 150);
            toDelete.forEach(([key]) => imageCache.delete(key));
        }
    }

    // 定期清理内存
    setInterval(cleanupMemory, 60000); // 每分钟清理一次

    // --- 8. 启动 ---
    if (galleryId && galleryToken) {
        injectUI();
    }

})();