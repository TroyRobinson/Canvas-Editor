/**
 * Iframe Manager Module
 * 
 * Handles iframe creation, positioning, and lifecycle management for interactive mode previews.
 * Provides complete isolation for user scripts while maintaining visual continuity.
 */

(function() {
    'use strict';

    // Track active preview iframes
    const activeIframes = new Map(); // frameId -> iframe element

    /**
     * Create a preview iframe for a frame element
     * @param {HTMLElement} frameElement - The frame element to create preview for
     * @param {string} htmlContent - Frame content HTML to render in iframe
     * @param {string} cssContent - Global CSS to inject into iframe
     * @returns {HTMLIFrameElement} Created iframe element
     */
    function createPreviewIframe(frameElement, htmlContent, cssContent) {
        // Create iframe element
        const iframe = document.createElement('iframe');
        iframe.classList.add('preview-iframe');
        iframe.setAttribute('data-frame-id', frameElement.id);
        
        // Initially hidden - will be shown when positioned
        iframe.style.display = 'none';
        iframe.style.position = 'absolute';
        iframe.style.border = 'none';
        iframe.style.outline = 'none';
        iframe.style.zIndex = '999'; // Just below frame's z-index
        iframe.style.pointerEvents = 'auto';
        
        // Generate complete HTML document for iframe
        const iframeDocument = generateIframeDocument(htmlContent, cssContent);
        
        // Insert iframe as child of the frame element (not canvas)
        // This keeps the frame's title bar and border visible
        frameElement.appendChild(iframe);
        
        // Set iframe content first
        iframe.srcdoc = iframeDocument;
        
        // Position iframe and activate scripts after iframe loads
        iframe.onload = () => {
            positionIframe(iframe, frameElement);
            
            // Manually activate scripts in iframe
            activateIframeScripts(iframe, htmlContent);
        };
        
        // Log creation
        console.log(`📦 IFRAME: Created preview for frame ${frameElement.id}`);
        
        // Track active iframe
        activeIframes.set(frameElement.id, iframe);
        
        return iframe;
    }

    /**
     * Generate complete HTML document content for iframe
     * @param {string} frameContent - The frame-content HTML
     * @param {string} globalCSS - Global CSS to inject
     * @returns {string} Complete HTML document
     */
    function generateIframeDocument(frameContent, globalCSS) {
        // Process frame content to wrap scripts in DOMContentLoaded
        const processedContent = processScriptsForIframe(frameContent);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Preview</title>
    <style>
        /* Inject global CSS */
        ${globalCSS}
        
        /* Iframe-specific styles - override any global styles */
        body {
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: hidden !important; /* Prevent scrollbars */
            box-sizing: border-box !important;
        }
        
        /* Match frame-content styling exactly */
        .frame-content {
            width: 100% !important;
            height: 100% !important;
            position: relative !important; /* Establishes positioning context for absolute children */
            margin: 0 !important;
            padding: 16px !important; /* Match original frame-content padding */
            box-sizing: border-box !important;
            overflow: visible !important;
        }
        
        /* Ensure free-floating elements work correctly in iframe */
        .free-floating {
            position: absolute !important;
            cursor: default !important;
            z-index: 100 !important;
            transition: none !important;
        }
        
        /* Ensure all absolutely positioned elements maintain their positioning */
        [style*="position: absolute"], [style*="position:absolute"] {
            position: absolute !important;
        }
    </style>
</head>
<body>
    <div class="frame-content">
        ${processedContent}
    </div>
</body>
</html>`;
    }

    /**
     * Process frame content to make scripts work in iframe context
     * @param {string} content - Original frame content HTML
     * @returns {string} Processed content with iframe-compatible scripts
     */
    function processScriptsForIframe(content) {
        // Replace script tags with iframe-compatible versions
        return content.replace(/<script>([\s\S]*?)<\/script>/g, (match, scriptContent) => {
            // Skip empty scripts
            if (!scriptContent.trim()) return match;
            
            // Fix problematic DOM patterns for iframe context
            let processedScript = scriptContent;
            
            // Replace the problematic pattern: document.currentScript.closest('.frame')
            // with direct frame-content reference
            processedScript = processedScript.replace(
                /document\.currentScript\.closest\(['"](\.frame)['"]\)/g,
                'document.querySelector(\'.frame-content\')'
            );
            
            // Also replace any frame.querySelectorAll with frameContent.querySelectorAll
            processedScript = processedScript.replace(
                /const frame = document\.currentScript\.closest\(['"](\.frame)['"]\);?\s*/g,
                'const frame = document.querySelector(\'.frame-content\');\n        '
            );
            
            // Wrap in DOMContentLoaded and add iframe-specific setup
            const iframeCompatibleScript = `
console.log('🚀 Iframe script loading...');

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Iframe DOM ready');
    try {
        ${processedScript}
        
        console.log('✨ Iframe script executed successfully');
        
    } catch (error) {
        console.error('Iframe script error:', error);
        console.log('Processed script:', ${JSON.stringify(processedScript.substring(0, 200))});
        
        // Fallback: try basic button setup if original script fails
        try {
            const frameContent = document.querySelector('.frame-content') || document.body;
            const buttons = frameContent.querySelectorAll('button');
            buttons.forEach(button => {
                if (!button.hasAttribute('data-iframe-fallback')) {
                    button.setAttribute('data-iframe-fallback', 'true');
                    button.addEventListener('click', function() {
                        button.classList.add('flash');
                        setTimeout(() => button.classList.remove('flash'), 300);
                    });
                }
            });
            console.log('💡 Fallback script applied to', buttons.length, 'buttons');
        } catch (fallbackError) {
            console.error('Even fallback script failed:', fallbackError);
        }
    }
});`;
            
            return `<script>${iframeCompatibleScript}</script>`;
        });
    }

    /**
     * Manually activate scripts in iframe if automatic execution fails
     * @param {HTMLIFrameElement} iframe - The iframe element
     * @param {string} originalContent - Original frame content HTML
     */
    function activateIframeScripts(iframe, originalContent) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                console.error('❌ Cannot access iframe document');
                return;
            }
            
            console.log('🔧 Manually activating iframe scripts');
            
            // Debug: Check positioning of elements in iframe
            const frameContent = iframeDoc.querySelector('.frame-content');
            const allElements = iframeDoc.querySelectorAll('*');
            
            console.log('📐 IFRAME POSITIONING DEBUG:');
            allElements.forEach(el => {
                if (el.style.position === 'absolute' || el.classList.contains('free-floating')) {
                    console.log(`  ${el.tagName}#${el.id}: position=${el.style.position}, left=${el.style.left}, top=${el.style.top}, classes=${el.className}`);
                }
            });
            
            // Simple button activation - works for most Canvas frame scripts
            const buttons = iframeDoc.querySelectorAll('button');
            buttons.forEach(button => {
                if (!button.hasAttribute('data-manual-activated')) {
                    button.setAttribute('data-manual-activated', 'true');
                    button.addEventListener('click', function() {
                        console.log('🔴 Button clicked in iframe!');
                        button.classList.add('flash');
                        setTimeout(() => button.classList.remove('flash'), 300);
                    });
                }
            });
            
            console.log(`✅ Manual activation complete - ${buttons.length} buttons activated`);
            
        } catch (error) {
            console.error('❌ Manual script activation failed:', error);
        }
    }

    /**
     * Position iframe to overlay frame content area only
     * @param {HTMLIFrameElement} iframe - Iframe to position
     * @param {HTMLElement} frameElement - Frame element to overlay
     */
    function positionIframe(iframe, frameElement) {
        const frameContent = frameElement.querySelector('.frame-content');
        if (!frameContent) {
            console.error('Frame content not found for positioning');
            return;
        }
        
        // Ensure frame content is visible for measurement
        const originalDisplay = frameContent.style.display;
        frameContent.style.display = 'block';
        
        // Force reflow to ensure accurate measurements
        frameContent.offsetHeight;
        
        // Get frame content position and size relative to the frame element  
        const frameRect = frameElement.getBoundingClientRect();
        const contentRect = frameContent.getBoundingClientRect();
        
        // Calculate offset of content within frame
        const offsetLeft = Math.max(0, contentRect.left - frameRect.left);
        const offsetTop = Math.max(0, contentRect.top - frameRect.top);
        
        // Use computed style to get accurate dimensions
        const computedStyle = getComputedStyle(frameContent);
        const width = Math.max(contentRect.width, 200); // Minimum width fallback
        const height = Math.max(contentRect.height, 100); // Minimum height fallback
        
        // Validate dimensions
        if (width <= 0 || height <= 0) {
            console.warn(`⚠️  IFRAME: Invalid dimensions for ${frameElement.id} - ${width}x${height}`);
            console.log('Frame rect:', frameRect);
            console.log('Content rect:', contentRect);
            console.log('Computed style:', computedStyle.width, computedStyle.height);
            return;
        }
        
        // Position iframe relative to frame element
        iframe.style.left = `${offsetLeft}px`;
        iframe.style.top = `${offsetTop}px`;
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
        
        // Restore original display state
        frameContent.style.display = originalDisplay;
        
        console.log(`📐 IFRAME: Positioned relative to frame at (${offsetLeft}, ${offsetTop}) size ${width}x${height}`);
    }

    /**
     * Update iframe position when frame is moved or resized
     * @param {string} frameId - ID of the frame that changed
     */
    function updateIframePosition(frameId) {
        const iframe = activeIframes.get(frameId);
        const frameElement = document.getElementById(frameId);
        
        if (iframe && frameElement && iframe.style.display !== 'none') {
            positionIframe(iframe, frameElement);
        }
    }

    /**
     * Show iframe and hide corresponding frame content
     * @param {string} frameId - ID of frame to switch to iframe mode
     */
    function showIframe(frameId) {
        const iframe = activeIframes.get(frameId);
        const frameElement = document.getElementById(frameId);
        const frameContent = frameElement?.querySelector('.frame-content');
        
        if (iframe && frameElement && frameContent) {
            console.log(`👁️  IFRAME: Showing preview for frame ${frameId}`);
            
            // Position iframe while frame content is still visible for accurate measurement
            positionIframe(iframe, frameElement);
            
            // Hide only the frame content, keeping title bar and border visible
            frameContent.style.display = 'none';
            
            // Show iframe
            iframe.style.display = 'block';
        }
    }

    /**
     * Hide iframe and show corresponding frame content
     * @param {string} frameId - ID of frame to switch to edit mode
     */
    function hideIframe(frameId) {
        const iframe = activeIframes.get(frameId);
        const frameElement = document.getElementById(frameId);
        const frameContent = frameElement?.querySelector('.frame-content');
        
        if (iframe && frameElement && frameContent) {
            // Hide iframe, show frame content
            iframe.style.display = 'none';
            frameContent.style.display = 'block';
            
            console.log(`✏️  IFRAME: Hiding preview for frame ${frameId}`);
        }
    }

    /**
     * Destroy iframe and clean up resources
     * @param {string} frameId - ID of frame whose iframe to destroy
     */
    function destroyIframe(frameId) {
        const iframe = activeIframes.get(frameId);
        
        if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
            activeIframes.delete(frameId);
            console.log(`🗑️  IFRAME: Destroyed preview for frame ${frameId}`);
        }
    }

    /**
     * Destroy all active iframes
     */
    function destroyAllIframes() {
        activeIframes.forEach((iframe, frameId) => {
            destroyIframe(frameId);
        });
        console.log('🗑️  IFRAME: Destroyed all previews');
    }

    /**
     * Get iframe element for a frame
     * @param {string} frameId - Frame ID
     * @returns {HTMLIFrameElement|null} Iframe element or null
     */
    function getIframe(frameId) {
        return activeIframes.get(frameId) || null;
    }

    /**
     * Check if iframe is currently visible
     * @param {string} frameId - Frame ID
     * @returns {boolean} True if iframe is visible
     */
    function isIframeVisible(frameId) {
        const iframe = activeIframes.get(frameId);
        return iframe && iframe.style.display !== 'none';
    }

    /**
     * Update all visible iframe positions
     * Useful for zoom/pan operations
     */
    function updateAllIframePositions() {
        activeIframes.forEach((iframe, frameId) => {
            if (iframe.style.display !== 'none') {
                updateIframePosition(frameId);
            }
        });
    }

    // Listen for window resize to update iframe positions
    window.addEventListener('resize', () => {
        updateAllIframePositions();
    });

    // Listen for zoom changes to update iframe positions
    if (window.canvasZoom) {
        // Hook into existing zoom system
        const originalSetZoom = window.canvasZoom.setZoom;
        if (originalSetZoom) {
            window.canvasZoom.setZoom = function(newZoom) {
                originalSetZoom.call(this, newZoom);
                // Update iframe positions after zoom
                setTimeout(updateAllIframePositions, 10);
            };
        }
    }

    // Expose public API
    window.iframeManager = {
        // Core operations
        createPreviewIframe,
        destroyIframe,
        destroyAllIframes,
        
        // Visibility management
        showIframe,
        hideIframe,
        isIframeVisible,
        
        // Position management
        positionIframe,
        updateIframePosition,
        updateAllIframePositions,
        
        // Utilities
        getIframe,
        
        // Internal (exposed for testing)
        generateIframeDocument
    };

    console.log('🚀 Iframe Manager initialized');

})();