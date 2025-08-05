/**
 * LLM Manager Module
 * 
 * Handles integration with OpenRouter API for AI-powered code enhancement.
 * Provides functionality to analyze frame HTML and generate improved script/style code.
 */

(function() {
    'use strict';

    const OPENROUTER_API_KEY = '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';
    const OPENROUTER_MODEL = 'qwen/qwen3-coder';
    const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

    const ENHANCEMENT_PROMPT = "You are an expert web software developer, review the attached html code for insights on the user's intended functionality and respond with the full script tag and (if necessary) the style tag to make the code accurate to the user intended functionality";

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

        // Extract script content using regex
        const scriptMatch = response.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (scriptMatch) {
            result.script = scriptMatch[1].trim();
        }

        // Extract style content using regex
        const styleMatch = response.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch) {
            result.style = styleMatch[1].trim();
        }

        return result;
    }

    /**
     * Insert parsed script and style content back into frame
     * @param {HTMLElement} frame - The target frame
     * @param {Object} parsedContent - Object with script and style content
     */
    function insertContentIntoFrame(frame, parsedContent) {
        if (!frame) return;

        const frameContent = frame.querySelector('.frame-content');
        if (!frameContent) return;

        // Find existing script and style tags
        const scriptTag = frameContent.querySelector('script');
        const styleTag = frameContent.querySelector('style');

        // Update script content if provided and tag exists
        if (parsedContent.script && scriptTag) {
            scriptTag.textContent = parsedContent.script;
        }

        // Update style content if provided and tag exists
        if (parsedContent.style && styleTag) {
            styleTag.textContent = parsedContent.style;
        }

        // Reactivate scripts for this frame
        if (window.scriptManager && window.scriptManager.activateScripts) {
            window.scriptManager.activateScripts(frame);
        }
    }

    /**
     * Create and show loading spinner for a frame
     * @param {HTMLElement} frame - The frame to show spinner on
     * @returns {HTMLElement} - The spinner element
     */
    function showLoadingSpinner(frame) {
        if (!frame) return null;

        // Create spinner element
        const spinner = document.createElement('div');
        spinner.className = 'llm-loading-spinner';
        spinner.innerHTML = `
            <div class="spinner-circle"></div>
        `;

        // Position spinner relative to frame
        const rect = frame.getBoundingClientRect();
        const canvasRect = document.getElementById('canvas').getBoundingClientRect();
        
        spinner.style.position = 'absolute';
        spinner.style.left = (rect.right - canvasRect.left + 10) + 'px';
        spinner.style.top = (rect.top - canvasRect.top) + 'px';
        spinner.style.zIndex = '10000';

        // Add spinner styles if not already present
        if (!document.querySelector('#llm-spinner-styles')) {
            const styles = document.createElement('style');
            styles.id = 'llm-spinner-styles';
            styles.textContent = `
                .llm-loading-spinner {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.8);
                    border-radius: 50%;
                }
                
                .spinner-circle {
                    width: 16px;
                    height: 16px;
                    border: 2px solid #333;
                    border-top: 2px solid #fff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }

        // Add to canvas
        document.getElementById('canvas').appendChild(spinner);

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
                        role: 'user',
                        content: `${ENHANCEMENT_PROMPT}\n\nHTML code to analyze:\n\n${htmlContent}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
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