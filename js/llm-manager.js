/**
 * LLM Manager Module
 * 
 * Handles integration with OpenRouter API for AI-powered code enhancement.
 * Provides functionality to analyze frame HTML and generate improved script/style code.
 */

(function() {
    'use strict';

    const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

    // Get settings from localStorage or use defaults
    function getSettings() {
        const defaults = {
            apiKey: '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',
            model: 'qwen/qwen3-coder:nitro',
            temperature: 0,
            maxTokens: 10000,
            maxThinkingTokens: 2000
        };
        
        try {
            const stored = localStorage.getItem('canvasAISettings');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults and validate
                return {
                    apiKey: (parsed.apiKey && parsed.apiKey.trim()) ? parsed.apiKey.trim() : defaults.apiKey,
                    model: parsed.model && parsed.model.trim() ? parsed.model.trim() : defaults.model,
                    temperature: typeof parsed.temperature === 'number' ? parsed.temperature : defaults.temperature,
                    maxTokens: typeof parsed.maxTokens === 'number' && parsed.maxTokens > 0 ? parsed.maxTokens : defaults.maxTokens,
                    maxThinkingTokens: typeof parsed.maxThinkingTokens === 'number' ? parsed.maxThinkingTokens : defaults.maxThinkingTokens
                };
            }
        } catch (error) {
            console.warn('Error loading AI settings from localStorage:', error);
        }
        return defaults;
    }


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
     * Extract HTML content from a frame, keeping existing script and style tag contents for editing
     * @param {HTMLElement} frame - The frame element to process
     * @returns {string} - HTML with existing script/style contents intact
     */
    function extractHTMLWithExistingCode(frame) {
        if (!frame) return '';

        // Get the frame-content element
        const frameContent = frame.querySelector('.frame-content');
        if (!frameContent) return '';

        // Return the full innerHTML including existing scripts and styles
        return frameContent.innerHTML;
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

    // Snapshot all elements with IDs that have draggable/selectable state so it
    // can be restored after the frame content is regenerated by the LLM
    function snapshotSelectableState(container) {
        const snapshot = {};
        container.querySelectorAll('[id]').forEach(el => {
            snapshot[el.id] = {
                selectable: el.dataset.selectable === 'true',
                freeFloating: el.classList.contains('free-floating')
            };
        });
        return snapshot;
    }

    // Restore selectable/draggable state based on a previous snapshot
    function restoreSelectableState(container, snapshot) {
        Object.entries(snapshot).forEach(([id, state]) => {
            const el = container.querySelector(`#${CSS.escape(id)}`);
            if (!el) return;
            if (state.freeFloating) {
                el.classList.add('free-floating');
            }
            if (state.selectable) {
                el.dataset.selectable = 'true';
            }
        });
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

        // Snapshot current selectable/drag state so we can restore it after replacement
        const selectableSnapshot = snapshotSelectableState(oldFrameContent);

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

        // Restore previous selectable/drag state on matching elements
        restoreSelectableState(newFrameContent, selectableSnapshot);

        console.log('🧹 AI CLEANUP: Replaced frame content with clean version for', frame.id);

        // Re-establish Canvas behaviors on the new clean content
        reestablishFrameBehaviorsAfterAI(frame);

        // Scripts will be activated when entering interactive mode via iframe
        console.log('💡 AI CONTENT: Scripts will activate in interactive mode iframe');
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
        const settings = getSettings();
        console.log('Using AI settings:', settings);
        
        // API key should always be available now due to fallback, but add safety check
        if (!settings.apiKey || !settings.apiKey.trim()) {
            throw new Error('OpenRouter API key is required. Please configure it in Settings/Context tab.');
        }
        
        const requestBody = {
            model: settings.model || 'qwen/qwen3-coder:nitro',
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
            temperature: settings.temperature || 0,
            max_tokens: settings.maxTokens || 10000
        };

        // Add reasoning tokens (keep original behavior for now)
        requestBody.reasoning = {
            "effort": "low"  // Allocates approximately 20% of max_tokens for reasoning.
        };

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Canvas Builder - AI Code Enhancement'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorDetails = `${response.status} ${response.statusText}`;
            try {
                const errorBody = await response.text();
                console.error('API Error Details:', errorBody);
                errorDetails += ` - ${errorBody}`;
            } catch (e) {
                console.error('Could not parse error response');
            }
            throw new Error(`OpenRouter API error: ${errorDetails}`);
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

        const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date();
        
        // Get frame title for display
        const frameTitle = frame.querySelector('.frame-title')?.textContent || 'Untitled Frame';
        
        // Emit enhancement started event
        const startEvent = new CustomEvent('enhancementStarted', {
            detail: {
                id: requestId,
                frameId: frame.id,
                frameTitle: frameTitle,
                timestamp: timestamp,
                status: 'processing'
            }
        });
        document.dispatchEvent(startEvent);

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

            // Emit enhancement completed event
            const successEvent = new CustomEvent('enhancementCompleted', {
                detail: {
                    id: requestId,
                    frameId: frame.id,
                    frameTitle: frameTitle,
                    timestamp: timestamp,
                    completedAt: new Date(),
                    status: 'success',
                    response: aiResponse,
                    script: parsedContent.script,
                    style: parsedContent.style
                }
            });
            document.dispatchEvent(successEvent);

        } catch (error) {
            console.error('Error during AI enhancement:', error);
            // You could show an error message to the user here
            alert(`AI enhancement failed: ${error.message}`);

            // Emit enhancement failed event
            const errorEvent = new CustomEvent('enhancementFailed', {
                detail: {
                    id: requestId,
                    frameId: frame.id,
                    frameTitle: frameTitle,
                    timestamp: timestamp,
                    completedAt: new Date(),
                    status: 'error',
                    error: error.message
                }
            });
            document.dispatchEvent(errorEvent);
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

    /**
     * Enhanced function to handle custom user messages
     * @param {HTMLElement} frame - The frame to enhance
     * @param {string} userMessage - Custom message from user
     */
    async function enhanceFrameWithCustomMessage(frame, userMessage) {
        if (!frame) {
            console.error('No frame provided for AI enhancement');
            return;
        }

        if (!userMessage || !userMessage.trim()) {
            console.error('No user message provided for custom enhancement');
            return;
        }

        const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date();
        
        // Get frame title for display
        const frameTitle = frame.querySelector('.frame-title')?.textContent || 'Untitled Frame';
        
        // Emit enhancement started event
        const startEvent = new CustomEvent('enhancementStarted', {
            detail: {
                id: requestId,
                frameId: frame.id,
                frameTitle: frameTitle,
                timestamp: timestamp,
                status: 'processing',
                customMessage: userMessage
            }
        });
        document.dispatchEvent(startEvent);

        const spinner = showLoadingSpinner(frame);
        
        // Capture selection state before AI generation 
        const selectedElementIds = window.getSelectedElements ? 
            window.getSelectedElements().map(el => el.id).filter(id => id) : [];

        try {
            // Extract clean HTML
            const cleanHTML = extractCleanHTML(frame);
            console.log('Extracted HTML for AI analysis:', cleanHTML);

            // Call OpenRouter API with custom message
            const aiResponse = await callOpenRouterWithMessage(cleanHTML, userMessage);
            console.log('AI Response:', aiResponse);

            // Parse the response
            const parsedContent = parseAIResponse(aiResponse);
            console.log('Parsed content:', parsedContent);

            // Insert content back into frame
            insertContentIntoFrame(frame, parsedContent);
            
            // Restore selection state after AI generation
            restoreSelectionState(selectedElementIds);

            console.log('AI enhancement with custom message completed successfully');

            // Emit enhancement completed event
            const successEvent = new CustomEvent('enhancementCompleted', {
                detail: {
                    id: requestId,
                    frameId: frame.id,
                    frameTitle: frameTitle,
                    timestamp: timestamp,
                    completedAt: new Date(),
                    status: 'success',
                    response: aiResponse,
                    customMessage: userMessage,
                    script: parsedContent.script,
                    style: parsedContent.style
                }
            });
            document.dispatchEvent(successEvent);

        } catch (error) {
            console.error('Error during AI enhancement with custom message:', error);
            alert(`AI enhancement failed: ${error.message}`);

            // Emit enhancement failed event
            const errorEvent = new CustomEvent('enhancementFailed', {
                detail: {
                    id: requestId,
                    frameId: frame.id,
                    frameTitle: frameTitle,
                    timestamp: timestamp,
                    completedAt: new Date(),
                    status: 'error',
                    error: error.message,
                    customMessage: userMessage
                }
            });
            document.dispatchEvent(errorEvent);
        } finally {
            // Always hide the spinner
            hideLoadingSpinner(spinner);
        }
    }

    /**
     * Make API call to OpenRouter with custom user message
     * @param {string} htmlContent - The clean HTML content to analyze
     * @param {string} userMessage - Custom message from user
     * @returns {Promise<string>} - The AI response
     */
    async function callOpenRouterWithMessage(htmlContent, userMessage) {
        const settings = getSettings();
        console.log('Using AI settings for custom message:', settings);
        
        // API key should always be available now due to fallback, but add safety check
        if (!settings.apiKey || !settings.apiKey.trim()) {
            throw new Error('OpenRouter API key is required. Please configure it in Settings/Context tab.');
        }
        
        const requestBody = {
            model: settings.model || 'qwen/qwen3-coder:nitro',
            messages: [
                {
                    role: 'system',
                    content: window.llmPrompt.getSystemPrompt()
                },
                {
                    role: 'user',
                    content: window.llmPrompt.getUserPromptWithMessage(htmlContent, userMessage)
                }
            ],
            temperature: settings.temperature || 0,
            max_tokens: settings.maxTokens || 10000
        };

        // Add reasoning tokens (keep original behavior for now)
        requestBody.reasoning = {
            "effort": "low"  // Allocates approximately 20% of max_tokens for reasoning.
        };

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Canvas Builder - AI Code Enhancement'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorDetails = `${response.status} ${response.statusText}`;
            try {
                const errorBody = await response.text();
                console.error('API Error Details:', errorBody);
                errorDetails += ` - ${errorBody}`;
            } catch (e) {
                console.error('Could not parse error response');
            }
            throw new Error(`OpenRouter API error: ${errorDetails}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenRouter API');
        }

        return data.choices[0].message.content;
    }

    /**
     * Enhanced function to handle custom user messages in editing mode (keeps existing code)
     * @param {HTMLElement} frame - The frame to enhance
     * @param {string} userMessage - Custom message from user
     */
    async function enhanceFrameWithEditMessage(frame, userMessage) {
        if (!frame) {
            console.error('No frame provided for AI enhancement');
            return;
        }

        if (!userMessage || !userMessage.trim()) {
            console.error('No user message provided for custom enhancement');
            return;
        }

        const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date();
        
        // Get frame title for display
        const frameTitle = frame.querySelector('.frame-title')?.textContent || 'Untitled Frame';
        
        // Emit enhancement started event
        const startEvent = new CustomEvent('enhancementStarted', {
            detail: {
                id: requestId,
                frameId: frame.id,
                frameTitle: frameTitle,
                timestamp: timestamp,
                status: 'processing',
                customMessage: userMessage,
                editMode: true
            }
        });
        document.dispatchEvent(startEvent);

        const spinner = showLoadingSpinner(frame);
        
        // Capture selection state before AI generation 
        const selectedElementIds = window.getSelectedElements ? 
            window.getSelectedElements().map(el => el.id).filter(id => id) : [];

        try {
            // Extract HTML with existing code (no stripping)
            const htmlWithCode = extractHTMLWithExistingCode(frame);
            console.log('Extracted HTML with existing code for AI analysis:', htmlWithCode);

            // Call OpenRouter API with edit message
            const aiResponse = await callOpenRouterWithEditMessage(htmlWithCode, userMessage);
            console.log('AI Response:', aiResponse);

            // Parse the response
            const parsedContent = parseAIResponse(aiResponse);
            console.log('Parsed content:', parsedContent);

            // Insert content back into frame
            insertContentIntoFrame(frame, parsedContent);
            
            // Restore selection state after AI generation
            restoreSelectionState(selectedElementIds);

            console.log('AI enhancement with edit message completed successfully');

            // Emit enhancement completed event
            const successEvent = new CustomEvent('enhancementCompleted', {
                detail: {
                    id: requestId,
                    frameId: frame.id,
                    frameTitle: frameTitle,
                    timestamp: timestamp,
                    completedAt: new Date(),
                    status: 'success',
                    response: aiResponse,
                    customMessage: userMessage,
                    editMode: true,
                    script: parsedContent.script,
                    style: parsedContent.style
                }
            });
            document.dispatchEvent(successEvent);

        } catch (error) {
            console.error('Error during AI enhancement with edit message:', error);
            alert(`AI enhancement failed: ${error.message}`);

            // Emit enhancement failed event
            const errorEvent = new CustomEvent('enhancementFailed', {
                detail: {
                    id: requestId,
                    frameId: frame.id,
                    frameTitle: frameTitle,
                    timestamp: timestamp,
                    completedAt: new Date(),
                    status: 'error',
                    error: error.message,
                    customMessage: userMessage,
                    editMode: true
                }
            });
            document.dispatchEvent(errorEvent);
        } finally {
            // Always hide the spinner
            hideLoadingSpinner(spinner);
        }
    }

    /**
     * Make API call to OpenRouter with edit message (keeps existing code)
     * @param {string} htmlContent - The HTML content with existing code
     * @param {string} userMessage - Custom message from user
     * @returns {Promise<string>} - The AI response
     */
    async function callOpenRouterWithEditMessage(htmlContent, userMessage) {
        const settings = getSettings();
        console.log('Using AI settings for edit message:', settings);
        
        // API key should always be available now due to fallback, but add safety check
        if (!settings.apiKey || !settings.apiKey.trim()) {
            throw new Error('OpenRouter API key is required. Please configure it in Settings/Context tab.');
        }
        
        const requestBody = {
            model: settings.model || 'qwen/qwen3-coder:nitro',
            messages: [
                {
                    role: 'system',
                    content: window.llmPrompt.getSystemPrompt()
                },
                {
                    role: 'user',
                    content: window.llmPrompt.getUserPromptEditMessage(htmlContent, userMessage)
                }
            ],
            temperature: settings.temperature || 0,
            max_tokens: settings.maxTokens || 10000
        };

        // Add reasoning tokens (keep original behavior for now)
        requestBody.reasoning = {
            "effort": "low"  // Allocates approximately 20% of max_tokens for reasoning.
        };

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Canvas Builder - AI Code Enhancement'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            let errorDetails = `${response.status} ${response.statusText}`;
            try {
                const errorBody = await response.text();
                console.error('API Error Details:', errorBody);
                errorDetails += ` - ${errorBody}`;
            } catch (e) {
                console.error('Could not parse error response');
            }
            throw new Error(`OpenRouter API error: ${errorDetails}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenRouter API');
        }

        return data.choices[0].message.content;
    }

    // Expose public API
    window.llmManager = {
        enhanceFrameWithAI: enhanceFrameWithAI,
        enhanceFrameWithCustomMessage: enhanceFrameWithCustomMessage,
        enhanceFrameWithEditMessage: enhanceFrameWithEditMessage,
        handleAIEnhancementShortcut: handleAIEnhancementShortcut,
        extractCleanHTML: extractCleanHTML,
        extractHTMLWithExistingCode: extractHTMLWithExistingCode,
        parseAIResponse: parseAIResponse,
        insertContentIntoFrame: insertContentIntoFrame
    };

    console.log('LLM Manager loaded successfully');

})();