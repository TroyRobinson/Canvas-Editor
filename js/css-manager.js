/**
 * CSS Manager Module
 * 
 * Handles CSS loading, persistence, application, and recovery for the canvas application.
 * Provides a clean API for CSS operations while maintaining edit state and recovery capabilities.
 */

(function() {
    'use strict';

    // CSS Manager State
    let cssContent = '';
    let cssStyleElement = null;
    let cssHasBeenEdited = false;
    let isInitialized = false;

    /**
     * Initialize the CSS Manager
     * Creates the dynamic style element and loads initial CSS content
     */
    function initialize() {
        if (isInitialized) return;

        try {
            // Create dynamic CSS style element
            cssStyleElement = document.createElement('style');
            cssStyleElement.id = 'dynamic-css';
            document.head.appendChild(cssStyleElement);

            // Load initial CSS content from embedded script
            loadInitialCSS();
            
            isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize CSS Manager:', error);
        }
    }

    /**
     * Load initial CSS content from the embedded script tag
     * Only loads if CSS has never been loaded before
     */
    function loadInitialCSS() {
        if (!cssContent && !cssHasBeenEdited) {
            const cssContentElement = document.getElementById('css-content');
            if (cssContentElement) {
                cssContent = cssContentElement.textContent || cssContentElement.innerText;
                // Apply initial CSS to the style element
                if (cssStyleElement && cssContent) {
                    cssStyleElement.textContent = cssContent;
                }
            } else {
                console.error('css-content element not found');
                cssContent = '/* CSS content not found */';
            }
        }
    }

    /**
     * Get the current CSS content
     * Includes recovery logic if content is missing
     * @returns {string} Current CSS content
     */
    function getCurrentCSS() {
        ensureInitialized();
        
        // If CSS content is missing, attempt recovery
        if (!cssContent) {
            recoverCSS();
        }
        
        return cssContent;
    }

    /**
     * Update the CSS content and apply it to the page
     * @param {string} newCSS - The new CSS content to apply
     */
    function updateCSS(newCSS) {
        ensureInitialized();
        
        try {
            // Update internal state
            cssContent = newCSS;
            cssHasBeenEdited = true;
            
            // Apply to the dynamic style element
            if (cssStyleElement) {
                cssStyleElement.textContent = newCSS;
            }
        } catch (error) {
            console.error('Error updating CSS:', error);
        }
    }

    /**
     * Check if CSS has been edited by the user
     * @returns {boolean} True if CSS has been modified
     */
    function hasBeenEdited() {
        return cssHasBeenEdited;
    }

    /**
     * Attempt to recover CSS content using fallback methods
     * Used when cssContent is empty but should have content
     */
    function recoverCSS() {
        if (cssHasBeenEdited && cssStyleElement && cssStyleElement.textContent) {
            // Recovery method 1: Get from the active style element
            cssContent = cssStyleElement.textContent;
        } else {
            // Recovery method 2: Reset and reload from embedded script
            cssHasBeenEdited = false;
            loadInitialCSS();
        }
    }

    /**
     * Reset the CSS Manager to initial state
     * Useful for testing or reinitializing
     */
    function reset() {
        cssContent = '';
        cssHasBeenEdited = false;
        isInitialized = false;
        
        // Remove existing style element
        if (cssStyleElement && cssStyleElement.parentNode) {
            cssStyleElement.parentNode.removeChild(cssStyleElement);
        }
        cssStyleElement = null;
    }

    /**
     * Ensure CSS Manager is initialized
     * Safe to call multiple times
     */
    function ensureInitialized() {
        if (!isInitialized) {
            initialize();
        }
    }

    /**
     * Get the dynamic style element
     * @returns {HTMLStyleElement} The style element used for CSS application
     */
    function getStyleElement() {
        ensureInitialized();
        return cssStyleElement;
    }

    /**
     * Get initialization status
     * @returns {boolean} True if CSS Manager has been initialized
     */
    function getInitializationStatus() {
        return isInitialized;
    }

    /**
     * Inject current CSS into an iframe document
     * @param {Document} iframeDocument - The iframe's document object
     */
    function injectIntoIframe(iframeDocument) {
        ensureInitialized();
        
        try {
            // Create style element in iframe
            const styleElement = iframeDocument.createElement('style');
            styleElement.id = 'injected-css';
            styleElement.textContent = getCurrentCSS();
            
            // Insert into iframe head
            iframeDocument.head.appendChild(styleElement);
            
            console.log('💉 CSS: Injected into iframe');
        } catch (error) {
            console.error('Error injecting CSS into iframe:', error);
        }
    }

    // Expose public API
    window.cssManager = {
        // Core operations
        initialize,
        getCurrentCSS,
        updateCSS,
        hasBeenEdited,
        
        // Recovery and maintenance
        recoverCSS,
        reset,
        
        // Integration helpers
        ensureInitialized,
        getStyleElement,
        getInitializationStatus,
        injectIntoIframe
    };


})();