/**
 * LLM Manager Module
 * 
 * Handles integration with OpenRouter API for AI-powered code enhancement.
 * Provides functionality to analyze frame HTML and generate improved script/style code.
 */

(function() {
    'use strict';

    const OPENROUTER_API_KEY = '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';
    const OPENROUTER_MODEL = 'qwen/qwen3-coder:nitro';
    const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';


    /**
     * Extract HTML content from a frame, stripping out script and style tag contents
     * @param {HTMLElement} frame - The frame element to process
     * @returns {string} - Clean HTML without script/style contents
     */
    function extractCleanHTML(frame) {
        if (!frame) return '';

        // Get the frame-content element
        const frameContent = frame.querySelector('.frame-content');
        if (!frameContent) return '';

        // Clone the frame content to avoid modifying the original
        const clone = frameContent.cloneNode(true);

        // Remove script and style tag contents but keep the tags
        const scripts = clone.querySelectorAll('script');
        const styles = clone.querySelectorAll('style');

        scripts.forEach(script => {
            script.textContent = '';
        });

        styles.forEach(style => {
            style.textContent = '';
        });

        return clone.innerHTML;
    }

    /**
     * Parse AI response to extract script and style content
     * @param {string} response - AI response text
     * @returns {Object} - Object containing script and style content
     */
    function parseAIResponse(response) {
        const result = {
            script: '',
            style: ''
        };

        // Extract script content using regex - try complete tags first, then incomplete
        let scriptMatch = response.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (scriptMatch) {
            result.script = scriptMatch[1].trim();
        } else {
            // Try to match incomplete script tag (missing closing tag)
            scriptMatch = response.match(/<script[^>]*>([\s\S]*?)$/i);
            if (scriptMatch) {
                result.script = scriptMatch[1].trim();
                console.log('Found incomplete script tag, extracted content:', result.script);
            }
        }

        // Extract style content using regex - try complete tags first, then incomplete
        let styleMatch = response.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
            result.style = styleMatch[1].trim();
        } else {
            // Try to match incomplete style tag (missing closing tag)
            styleMatch = response.match(/<style[^>]*>([\s\S]*?)(?=<script|$)/i);
            if (styleMatch) {
                result.style = styleMatch[1].trim();
                console.log('Found incomplete style tag, extracted content:', result.style);
            }
        }

        console.log('Parsing result:', result);
        return result;
    }

    /**
     * Insert AI-generated content into frame with proper cleanup (prevents content accumulation)
     * @param {HTMLElement} frame - The target frame
     * @param {Object} parsedContent - Object with script and style content
     */
    function insertContentIntoFrame(frame, parsedContent) {
        if (!frame) return;

        const oldFrameContent = frame.querySelector('.frame-content');
        if (!oldFrameContent) return;

        // Create clean frame-content from the same template sent to AI
        const cleanHTML = extractCleanHTML(frame);
        const newFrameContent = document.createElement('div');
        newFrameContent.className = 'frame-content';
        newFrameContent.innerHTML = cleanHTML;

        // Update the new clean content with AI-generated script and style
        const scriptTag = newFrameContent.querySelector('script');
        const styleTag = newFrameContent.querySelector('style');

        if (parsedContent.script && scriptTag) {
            scriptTag.textContent = parsedContent.script;
        }

        if (parsedContent.style && styleTag) {
            styleTag.textContent = parsedContent.style;
        }

        // Use proper element replacement to prevent content accumulation
        const parent = oldFrameContent.parentElement;
        const nextSibling = oldFrameContent.nextSibling;
        
        // CRITICAL: Complete element replacement strips all old generated content
        parent.removeChild(oldFrameContent);
        parent.insertBefore(newFrameContent, nextSibling);

        console.log('🧹 AI CLEANUP: Replaced frame content with clean version for', frame.id);

        // Re-establish Canvas behaviors on the new clean content
        reestablishFrameBehaviorsAfterAI(frame);

        // Reactivate scripts for this frame on clean content
        if (window.scriptManager && window.scriptManager.activateScripts) {
            window.scriptManager.activateScripts(frame);
        }
    }

    /**
     * Re-establish Canvas behaviors after AI content replacement
     * @param {HTMLElement} frame - The frame that was updated
     */
    function reestablishFrameBehaviorsAfterAI(frame) {
        const frameContent = frame.querySelector('.frame-content');
        if (!frameContent) return;
        
        console.log(`🔧 AI RE-ESTABLISHING: Behaviors for frame ${frame.id}`);
        
        // Re-establish frame-level behaviors first
        if (window.setupFrame) {
            window.setupFrame(frame);
        } else {
            // Fallback: manually setup frame behaviors
            const titleBar = frame.querySelector('.frame-title');
            if (titleBar && window.setupFrameDragging) {
                window.setupFrameDragging(frame, titleBar);
            }
            if (window.makeSelectable) {
                window.makeSelectable(frame);
            }
        }
        
        // Ensure all elements have IDs for tracking
        if (window.ensureAllElementsHaveIds) {
            window.ensureAllElementsHaveIds(frameContent);
        }
        
        // Re-establish behaviors for all elements
        frameContent.querySelectorAll('*').forEach(element => {
            // Skip resize handles
            if (element.classList.contains('resize-handle')) return;
            
            // Re-establish behaviors for free-floating elements
            if (element.classList.contains('free-floating')) {
                if (window.setupElementDragging) {
                    window.setupElementDragging(element);
                }
                if (window.makeSelectable) {
                    window.makeSelectable(element);
                }
                // Don't call addSelectionAnchors directly - let selection system handle it via events
            }
            // Re-establish behaviors for static elements
            else if (window.makeSelectable) {
                window.makeSelectable(element);
            }
        });
        
        // Re-establish container behaviors
        if (window.makeContainerElementsSelectable) {
            window.makeContainerElementsSelectable(frameContent);
        }
        
        // Setup element extraction for the frame content
        if (window.setupElementExtraction) {
            window.setupElementExtraction(frameContent);
        }
        
        console.log(`✨ AI COMPLETED: Behavior re-establishment for frame ${frame.id}`);
    }

    /**
     * Restore selection state after AI generation
     * @param {string[]} selectedElementIds - Array of element IDs that were selected
     */
    function restoreSelectionState(selectedElementIds) {
        if (!selectedElementIds.length || !window.selectElement || !window.clearSelection) return;
        
        // Clear current selection first
        window.clearSelection();
        
        // Re-select elements by ID
        selectedElementIds.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                window.selectElement(element);
            }
        });
        
        console.log(`🎯 SELECTION RESTORED: ${selectedElementIds.length} elements re-selected`);
    }

    /**
     * Create and show loading spinner for a frame
     * @param {HTMLElement} frame - The frame to show spinner on
     * @returns {HTMLElement} - The spinner element
     */
    function showLoadingSpinner(frame) {
        if (!frame) return null;

        // Find the frame title bar
        const titleBar = frame.querySelector('.frame-title');
        if (!titleBar) return null;

        // Create spinner element
        const spinner = document.createElement('div');
        spinner.className = 'llm-loading-spinner';
        spinner.innerHTML = `
            <div class="spinner-circle"></div>
        `;

        // Add spinner styles if not already present
        if (!document.querySelector('#llm-spinner-styles')) {
            const styles = document.createElement('style');
            styles.id = 'llm-spinner-styles';
            styles.textContent = `
                .frame-title {
                    position: relative;
                }
                
                .llm-loading-spinner {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 50%;
                    z-index: 10;
                }
                
                .spinner-circle {
                    width: 12px;
                    height: 12px;
                    border: 2px solid #555;
                    border-top: 2px solid #fff;
                    border-radius: 50%;
                    animation: llm-spin 1s linear infinite;
                }
                
                @keyframes llm-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }

        // Add spinner to the title bar
        titleBar.appendChild(spinner);

        return spinner;
    }

    /**
     * Remove loading spinner
     * @param {HTMLElement} spinner - The spinner element to remove
     */
    function hideLoadingSpinner(spinner) {
        if (spinner && spinner.parentNode) {
            spinner.parentNode.removeChild(spinner);
        }
    }

    /**
     * Make API call to OpenRouter
     * @param {string} htmlContent - The clean HTML content to analyze
     * @returns {Promise<string>} - The AI response
     */
    async function callOpenRouter(htmlContent) {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Canvas Builder - AI Code Enhancement'
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: window.llmPrompt.getSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: window.llmPrompt.getUserPrompt(htmlContent)
                    }
                ],
                temperature: 0,
                "reasoning": {
                    "effort": "low"  // Allocates approximately 20% of max_tokens for reasoning
                  },
                max_tokens: 10000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenRouter API');
        }

        return data.choices[0].message.content;
    }

    /**
     * Main function to enhance selected frame with AI
     * @param {HTMLElement} frame - The frame to enhance
     */
    async function enhanceFrameWithAI(frame) {
        if (!frame) {
            console.error('No frame provided for AI enhancement');
            return;
        }

        const spinner = showLoadingSpinner(frame);
        
        // Capture selection state before AI generation 
        const selectedElementIds = window.getSelectedElements ? 
            window.getSelectedElements().map(el => el.id).filter(id => id) : [];

        try {
            // Extract clean HTML
            const cleanHTML = extractCleanHTML(frame);
            console.log('Extracted HTML for AI analysis:', cleanHTML);

            // Call OpenRouter API
            const aiResponse = await callOpenRouter(cleanHTML);
            console.log('AI Response:', aiResponse);

            // Parse the response
            const parsedContent = parseAIResponse(aiResponse);
            console.log('Parsed content:', parsedContent);

            // Insert content back into frame
            insertContentIntoFrame(frame, parsedContent);
            
            // Restore selection state after AI generation
            restoreSelectionState(selectedElementIds);

            console.log('AI enhancement completed successfully');

        } catch (error) {
            console.error('Error during AI enhancement:', error);
            // You could show an error message to the user here
            alert(`AI enhancement failed: ${error.message}`);
        } finally {
            // Always hide the spinner
            hideLoadingSpinner(spinner);
        }
    }

    /**
     * Handle the keyboard shortcut for AI enhancement
     */
    function handleAIEnhancementShortcut() {
        // Get the currently selected element
        const selectedElement = window.getSelectedElement ? window.getSelectedElement() : null;
        
        if (!selectedElement) {
            console.log('No element selected for AI enhancement');
            return;
        }

        // Check if the selected element is a frame or find the containing frame
        let targetFrame = null;
        
        if (selectedElement.classList.contains('frame')) {
            targetFrame = selectedElement;
        } else {
            // Look for parent frame
            targetFrame = selectedElement.closest('.frame');
        }

        if (!targetFrame) {
            console.log('Selected element is not in a frame, AI enhancement requires a frame');
            return;
        }

        // Enhance the frame with AI
        enhanceFrameWithAI(targetFrame);
    }

    // Expose public API
    window.llmManager = {
        enhanceFrameWithAI: enhanceFrameWithAI,
        handleAIEnhancementShortcut: handleAIEnhancementShortcut,
        extractCleanHTML: extractCleanHTML,
        parseAIResponse: parseAIResponse,
        insertContentIntoFrame: insertContentIntoFrame
    };

    console.log('LLM Manager loaded successfully');

})();