/**
 * Right Pane Manager Module
 * 
 * Manages the right-side panel UI with tabbed interface for various features.
 * Provides a common API for tabs to register and manage their content.
 */

(function() {
    'use strict';

    // State management
    let panelWidth = localStorage.getItem('rightPaneWidth') || '400px';
    let isDragging = false;
    let activeTab = null;
    let tabs = new Map();

    // DOM elements
    let panel = null;
    let resizer = null;
    let tabContainer = null;
    let contentContainer = null;

    // Initialize the right pane when the DOM is ready
    function init() {
        panel = document.getElementById('right-pane-panel');
        resizer = document.getElementById('right-pane-resizer');
        tabContainer = document.getElementById('right-pane-tabs');
        contentContainer = document.getElementById('right-pane-content');

        if (!panel || !resizer || !tabContainer || !contentContainer) {
            console.error('Right pane elements not found in DOM');
            return;
        }

        setupPanel();
        setupResizer();
        setupEventListeners();
        
        // Initially hide the panel
        hidePanel();
    }

    // Setup initial panel state
    function setupPanel() {
        panel.style.width = panelWidth;
        panel.style.right = '0';
        panel.style.top = '0';
        panel.style.height = '100vh';
        panel.style.position = 'fixed';
        panel.style.zIndex = '1000';
    }

    // Setup resize functionality
    function setupResizer() {
        resizer.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
    }

    // Setup event listeners
    function setupEventListeners() {
        // Tab click handling
        tabContainer.addEventListener('click', handleTabClick);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyDown);
    }

    // Handle tab clicks
    function handleTabClick(event) {
        const tabButton = event.target.closest('[data-tab]');
        if (tabButton) {
            const tabId = tabButton.dataset.tab;
            switchToTab(tabId);
        }
    }

    // Handle keyboard shortcuts
    function handleKeyDown(event) {
        // Escape to close panel (if no active tab content is handling it)
        if (event.key === 'Escape' && !event.defaultPrevented) {
            hidePanel();
        }
    }

    // Tab management
    function registerTab(tabId, config) {
        tabs.set(tabId, {
            ...config,
            element: null
        });

        // Create tab button
        const tabButton = document.createElement('button');
        tabButton.className = 'tab-button';
        tabButton.dataset.tab = tabId;
        tabButton.dataset.selectable = 'false'; // Prevent canvas selection system
        tabButton.textContent = config.title;
        tabContainer.appendChild(tabButton);

        // Create tab content container
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.dataset.tab = tabId;
        tabContent.dataset.selectable = 'false'; // Prevent canvas selection system
        tabContent.style.display = 'none';
        contentContainer.appendChild(tabContent);

        // Update tab reference
        tabs.get(tabId).element = tabContent;

        // Call onInit if provided
        if (config.onInit) {
            config.onInit(tabContent);
        }

        return tabContent;
    }

    function switchToTab(tabId) {
        if (!tabs.has(tabId)) {
            console.warn(`Tab ${tabId} not found`);
            return;
        }

        // Hide current tab
        if (activeTab) {
            const currentTabConfig = tabs.get(activeTab);
            const currentTabButton = tabContainer.querySelector(`[data-tab="${activeTab}"]`);
            const currentTabContent = currentTabConfig.element;

            if (currentTabButton) currentTabButton.classList.remove('tab-active');
            if (currentTabContent) currentTabContent.style.display = 'none';

            // Call onHide if provided
            if (currentTabConfig.onHide) {
                currentTabConfig.onHide();
            }
        }

        // Show new tab
        const newTabConfig = tabs.get(tabId);
        const newTabButton = tabContainer.querySelector(`[data-tab="${tabId}"]`);
        const newTabContent = newTabConfig.element;

        if (newTabButton) newTabButton.classList.add('tab-active');
        if (newTabContent) newTabContent.style.display = 'flex';

        activeTab = tabId;

        // Call onShow if provided
        if (newTabConfig.onShow) {
            newTabConfig.onShow();
        }

        // Show panel if hidden
        showPanel();
    }

    function getActiveTab() {
        return activeTab;
    }

    function getTabContent(tabId) {
        const tab = tabs.get(tabId);
        return tab ? tab.element : null;
    }

    // Panel visibility controls
    function showPanel() {
        panel.style.display = 'flex';
        document.body.style.paddingRight = panelWidth;
    }

    function hidePanel() {
        // Notify active tab about hiding
        if (activeTab) {
            const tabConfig = tabs.get(activeTab);
            if (tabConfig && tabConfig.onHide) {
                tabConfig.onHide();
            }
        }
        
        panel.style.display = 'none';
        document.body.style.paddingRight = '0';
    }

    function isVisible() {
        return panel && panel.style.display !== 'none';
    }

    // Resize functionality
    function startResize(event) {
        isDragging = true;
        document.body.style.cursor = 'ew-resize';
        event.preventDefault();
    }

    function handleResize(event) {
        if (!isDragging) return;

        const newWidth = window.innerWidth - event.clientX;
        const minWidth = 200;
        const maxWidth = window.innerWidth * 0.8;
        
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        panelWidth = constrainedWidth + 'px';
        
        panel.style.width = panelWidth;
        document.body.style.paddingRight = panelWidth;
        
        // Save to localStorage
        localStorage.setItem('rightPaneWidth', panelWidth);
    }

    function stopResize() {
        isDragging = false;
        document.body.style.cursor = '';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API
    window.rightPaneManager = {
        registerTab: registerTab,
        switchToTab: switchToTab,
        getActiveTab: getActiveTab,
        getTabContent: getTabContent,
        show: showPanel,
        hide: hidePanel,
        isVisible: isVisible
    };

})();