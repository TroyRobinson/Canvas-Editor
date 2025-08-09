/**
 * Script Manager Module (Simplified)
 * 
 * Handles script activation in edit mode. Interactive mode uses iframe isolation.
 * Most cleanup complexity removed since iframes provide natural script isolation.
 */

(function() {
    'use strict';

    // Scripts are no longer activated in edit mode - only in iframe interactive mode
    function activateScripts(element) {
        console.log('📝 EDIT MODE: Scripts not activated - iframe handles interactive script execution');
        console.log('💡 Scripts will run when entering interactive mode via iframe');
        
        // Only activate styles (they're safe and needed for visual editing)
        const styles = element.querySelectorAll('style');
        styles.forEach(style => {
            if (!style.dataset.activated) {
                style.dataset.activated = 'true';
            }
        });
        
        // Note: Scripts are deliberately not executed in edit mode
        // This prevents the complex event handler management we're eliminating
        // Scripts will execute safely within iframe context during interactive mode
    }


    // Script execution moved to iframe context - no longer needed in edit mode
    function executeScriptInContainer(scriptContent, containerElement) {
        console.log('⏭️ SKIPPED: Script execution disabled in edit mode');
        console.log('🎮 Scripts execute automatically in interactive mode iframe');
        // No-op: Scripts are handled by iframe activation in interactive mode
    }

    // Expose simplified public API
    window.scriptManager = {
        // Core script management (edit mode only)
        activateScripts: activateScripts,
        executeScriptInContainer: executeScriptInContainer
        
        // NOTE: Complex cleanup functions removed - iframe isolation eliminates need for:
        // - cleanupElementHandlers: iframes naturally isolate scripts
        // - reactivateContainerScripts: no cross-container script issues 
        // - cloneElementClean: no need to strip event handlers via cloning
        // - reestablishCanvasBehaviors: no behavior cleanup needed
    };

})();