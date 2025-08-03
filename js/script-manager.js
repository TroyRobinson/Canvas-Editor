/**
 * Script Manager Module
 * 
 * Handles activation, execution, and cleanup of user-inserted scripts within containers.
 * Provides clean separation between script management and UI concerns.
 */

(function() {
    'use strict';

    // Activate scripts within an element
    function activateScripts(element) {
        const scripts = element.querySelectorAll('script');
        const styles = element.querySelectorAll('style');
        
        // Activate styles first (they don't need special handling)
        styles.forEach(style => {
            if (!style.dataset.activated) {
                style.dataset.activated = 'true';
            }
        });
        
        // Clean up any existing script handlers for this container before activating new ones
        cleanupContainerScripts(element);
        
        // Process scripts
        scripts.forEach(script => {
            const scriptContent = script.textContent || script.innerText;
            if (!scriptContent.trim()) return; // Skip empty scripts
            
            try {
                // Execute the script with container scoping
                executeScriptInContainer(scriptContent, element);
                
                // Mark as activated
                script.dataset.activated = 'true';
                
                console.log('Script activated for element:', element.id);
            } catch (error) {
                console.error('Error activating script:', error);
                console.error('Script content:', scriptContent);
                // Mark as activated even if failed to prevent repeated attempts
                script.dataset.activated = 'true';
            }
        });
    }

    // Clean up existing script handlers for a container (when scripts are re-activated)
    function cleanupContainerScripts(element) {
        // For container script re-activation, we don't need complex cleanup
        // since we're re-running the entire script for the container
        console.log('Re-activating scripts for container:', element.id);
    }

    // Execute script with container scoping and currentScript support
    function executeScriptInContainer(scriptContent, containerElement) {
        const containerId = containerElement.id || 'canvas';
        
        // Find the actual script element in the container for currentScript support
        const scriptElements = containerElement.querySelectorAll('script');
        const currentScriptElement = Array.from(scriptElements).find(script => 
            script.textContent.includes(scriptContent.trim().substring(0, 50))
        );
        
        // Create wrapped script that provides container context and currentScript
        const wrappedScript = `
        (function() {
            const containerElement = arguments[0];
            const scriptElement = arguments[1];
            
            // Override document.querySelectorAll temporarily to scope to container
            const originalQuerySelectorAll = document.querySelectorAll;
            const originalCurrentScript = document.currentScript;
            
            document.querySelectorAll = function(selector) {
                return containerElement.querySelectorAll(selector);
            };
            
            // Provide a mock currentScript that points to the actual script element
            Object.defineProperty(document, 'currentScript', {
                get: function() {
                    return scriptElement;
                },
                configurable: true
            });
            
            try {
                ${scriptContent}
            } finally {
                // Restore original functions
                document.querySelectorAll = originalQuerySelectorAll;
                Object.defineProperty(document, 'currentScript', {
                    get: function() {
                        return originalCurrentScript;
                    },
                    configurable: true
                });
            }
        })`;
        
        try {
            // Execute the script with container scoping and currentScript support
            eval(wrappedScript)(containerElement, currentScriptElement);
        } catch (error) {
            console.error('Error executing script:', error);
            throw error;
        }
    }

    // Clean up script handlers from an element when it leaves a container using cloning
    function cleanupElementHandlers(element, oldContainerId) {
        console.log(`🧹 CLEANING: Element ${element.id} leaving container ${oldContainerId}`);
        
        // Always clone to strip ALL event listeners (both script and Canvas handlers)
        const cleanElement = cloneElementClean(element);
        
        // Replace the original element with the clean clone
        const parent = element.parentElement;
        const nextSibling = element.nextSibling;
        
        // Important: Remove the old element completely
        parent.removeChild(element);
        parent.insertBefore(cleanElement, nextSibling);
        
        // CRITICAL: Re-establish Canvas behaviors that were stripped by cloning
        reestablishCanvasBehaviors(cleanElement);
        
        console.log(`✅ CLEANED: Element ${cleanElement.id} is now clean of all script handlers`);
        
        return cleanElement; // Return the clean element for further processing
    }

    // Re-establish Canvas behaviors after cloning strips all event listeners
    function reestablishCanvasBehaviors(element) {
        // Re-establish selection behavior
        if (window.makeSelectable) {
            window.makeSelectable(element);
        }
        
        // Re-establish drag behavior for free-floating elements
        if (element.classList.contains('free-floating') && window.setupElementDragging) {
            window.setupElementDragging(element);
        }
        
        // Re-establish frame behaviors if it's a frame
        if (element.classList.contains('frame') && window.setupFrame) {
            window.setupFrame(element);
        }
        
        // Re-establish element-frame behaviors
        if (element.classList.contains('element-frame') && window.setupElementFrame) {
            window.setupElementFrame(element);
        }
        
        // Re-establish resize handles (this is usually handled by selection system)
        if (window.addResizeHandles && (element.classList.contains('free-floating') || element.classList.contains('frame') || element.classList.contains('element-frame'))) {
            window.addResizeHandles(element);
        }
        
        // Ensure the element is marked as selectable
        if (!element.dataset.selectable) {
            element.dataset.selectable = 'true';
        }
        
        console.log(`🔧 Re-established Canvas behaviors for element ${element.id}`);
    }

    // Clone an element while preserving all attributes but stripping event listeners
    function cloneElementClean(element) {
        const clone = element.cloneNode(true);
        
        // Ensure the clone has the same ID and attributes
        clone.id = element.id;
        clone.className = element.className;
        
        // Copy all inline styles
        clone.style.cssText = element.style.cssText;
        
        // Copy all data attributes and other attributes
        Array.from(element.attributes).forEach(attr => {
            if (attr.name !== 'id' && attr.name !== 'class' && attr.name !== 'style') {
                clone.setAttribute(attr.name, attr.value);
            }
        });
        
        return clone;
    }

    // Re-activate scripts in a container when elements are moved into it
    function reactivateContainerScripts(container, movedElement = null) {
        // Find the root container (frame or element-frame) that might have scripts
        let scriptContainer = container;
        
        // If the container is a frame content area, get the parent frame
        if (container.classList.contains('frame-content')) {
            scriptContainer = container.parentElement;
        }
        
        // Only re-activate scripts for containers that actually have scripts
        // Canvas typically doesn't have scripts, so don't activate for canvas moves
        if (scriptContainer.classList.contains('frame') || 
            scriptContainer.classList.contains('element-frame')) {
            
            console.log(`🔄 RE-ACTIVATING: Scripts for container ${scriptContainer.id}`);
            activateScripts(scriptContainer);
        } else if (scriptContainer.id === 'canvas') {
            console.log(`📋 CANVAS MOVE: Element moved to canvas, no script activation needed`);
        }
        
        // Check parent containers up the tree (but be more selective)
        let parent = scriptContainer.parentElement;
        while (parent && parent !== document.body && parent.id !== 'canvas') {
            if (parent.classList.contains('frame') || 
                parent.classList.contains('element-frame')) {
                
                console.log(`🔄 RE-ACTIVATING: Scripts for parent container ${parent.id}`);
                activateScripts(parent);
                break; // Only go up to the first script container
            }
            parent = parent.parentElement;
        }
    }

    // Expose public API
    window.scriptManager = {
        // Core script management
        activateScripts: activateScripts,
        executeScriptInContainer: executeScriptInContainer,
        
        // Element cleanup and reactivation
        cleanupElementHandlers: cleanupElementHandlers,
        reactivateContainerScripts: reactivateContainerScripts,
        
        // Utility functions
        cloneElementClean: cloneElementClean,
        reestablishCanvasBehaviors: reestablishCanvasBehaviors
    };

})();