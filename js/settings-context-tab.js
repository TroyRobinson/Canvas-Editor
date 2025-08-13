/**
 * Settings/Context Tab Module
 * 
 * Provides a settings interface for AI enhancement configuration including:
 * - Editable system and user prompts
 * - Model parameters (temperature, max tokens, etc.)
 * - Reset to defaults functionality
 * - Local storage persistence
 */

(function() {
    'use strict';

    // State management
    let tabContent = null;
    let systemPromptTextarea = null;
    let userPromptTextarea = null;
    let userPromptWithMessageTextarea = null;
    let userPromptEditMessageTextarea = null;
    let promptModeToggle = null;
    let currentPromptMode = 'no-message'; // 'no-message', 'message', or 'edit-message'
    let apiKeyInput = null;
    let modelInput = null;
    let temperatureInput = null;
    let maxTokensInput = null;
    let maxThinkingTokensInput = null;

    // Default values (hardcoded fallbacks)
    const DEFAULTS = {
        systemPrompt: `You are an expert web software developer specializing in enhancing HTML code within the Canvas Builder framework.

When given HTML code, analyze the user's intended functionality and respond with the complete script tag and (if necessary) style tag to implement that functionality accurately.

# CANVAS FRAMEWORK CONSTRAINTS:

1) **Script Execution Context**: Scripts are designed for editing in EDIT MODE but execute in isolated INTERACTIVE MODE iframes. Write scripts that work in both contexts.

2) **Animation Rules**: Elements with class 'free-floating' have 'transition: none !important', so use CSS @keyframes animations instead of transitions.

3) **Element Placement**: When creating elements dynamically, ALWAYS append to the frame content area. Use simple DOM queries since scripts run in isolated iframe context.

4) **Element Targeting**: Use standard DOM queries. In edit mode, scripts don't execute. In interactive mode, scripts run in iframe with frame content as the document root.

5) **Event Handler Pattern**: Use simple, standard event handling:
   \`\`\`javascript
   // Simple iframe-compatible pattern
   const buttons = document.querySelectorAll('button');
   buttons.forEach(button => {
       button.addEventListener('click', function() {
           // Event handler logic here
           button.classList.add('flash');
           setTimeout(() => button.classList.remove('flash'), 300);
       });
   });
   \`\`\`

6) **Canvas System**: Do not manipulate contenteditable, data-selectable, or other Canvas-managed attributes. Focus on adding new content/behavior only.

7) **Element Integration**: Wherever possible integrate with existing DOM elements. 'free-floating' class means absolutely positioned elements.

8) **Iframe Isolation**: Scripts will execute in isolated iframe context during interactive mode, so avoid relying on parent document or Canvas system APIs.

# STYLING:
- Maintain dark theme (white text on dark backgrounds)
- Ensure visual consistency with the Canvas Builder interface
- Use @keyframes for animations (not CSS transitions on free-floating elements)`,

        userPrompt: `Please analyze the following HTML code and enhance it with appropriate functionality:

\`\`\`html
{htmlContent}
\`\`\`

Respond with the complete script and style tags needed to make this code functional.`,

        userPromptWithMessage: `Please analyze the following HTML code and enhance it with the following functionality:

\`\`\`html
{htmlContent}
\`\`\`

<user_request>
{user_message}
</user_request>

Respond with the complete script and style tags needed to make this code functional.`,

        userPromptEditMessage: `Please analyze the following HTML code and update it with the following functionality:

\`\`\`html
{htmlContent}
\`\`\`

<user_request>
{user_message}
</user_request>

Respond with the edited script and style tags needed to make this code fully match the user's latest request.`,

        apiKey: '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',
        model: 'qwen/qwen3-coder:nitro',
        temperature: 0,
        maxTokens: 10000,
        maxThinkingTokens: 2000
    };

    // Initialize the settings/context tab
    function init() {
        if (!window.rightPaneManager) {
            console.error('Right Pane Manager not available');
            return;
        }

        // Register with the right pane manager
        tabContent = window.rightPaneManager.registerTab('settings-context', {
            title: 'Settings/Context',
            onInit: initializeTab,
            onShow: onTabShow,
            onHide: onTabHide
        });
    }

    // Initialize tab content when first created
    function initializeTab(container) {
        // Create the tab content structure
        container.innerHTML = `
            <div class="settings-content">
                <div class="settings-header">
                    <h3>AI Enhancement Settings</h3>
                    <button id="reset-defaults-btn" class="reset-button" data-selectable="false">
                        Reset to Defaults
                    </button>
                </div>
                
                <div class="settings-section">
                    <h4>API Configuration</h4>
                    <div class="api-key-section">
                        <div class="param-group api-key-group">
                            <label for="api-key-input">OpenRouter API Key</label>
                            <input type="password" id="api-key-input" class="param-input api-key-input" placeholder="Enter your OpenRouter API key (or leave empty for default)">
                            <p class="param-help">Get your own API key from <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> or leave empty to use the default key</p>
                        </div>
                    </div>
                    
                    <h4>Model Parameters</h4>
                    <div class="params-grid">
                        <div class="param-group">
                            <label for="model-input">Model</label>
                            <input type="text" id="model-input" class="param-input" placeholder="e.g. qwen/qwen3-coder:nitro">
                        </div>
                        
                        <div class="param-group">
                            <label for="temperature-input">Temperature</label>
                            <input type="number" id="temperature-input" class="param-input" min="0" max="2" step="0.1" placeholder="0">
                        </div>
                        
                        <div class="param-group">
                            <label for="max-tokens-input">Max Tokens</label>
                            <input type="number" id="max-tokens-input" class="param-input" min="100" max="50000" step="100" placeholder="10000">
                        </div>
                        
                        <div class="param-group">
                            <label for="max-thinking-tokens-input">Max Thinking Tokens</label>
                            <input type="number" id="max-thinking-tokens-input" class="param-input" min="0" max="10000" step="100" placeholder="2000">
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <div class="prompt-section">
                        <h4>User Prompt Template</h4>
                        <div class="prompt-mode-toggle">
                            <button class="mode-toggle-btn mode-active" data-mode="no-message" data-selectable="false">No Message</button>
                            <button class="mode-toggle-btn" data-mode="message" data-selectable="false">With Message</button>
                            <button class="mode-toggle-btn" data-mode="edit-message" data-selectable="false">Edit Message</button>
                        </div>
                        
                        <div id="no-message-prompt" class="prompt-mode-content">
                            <p class="prompt-help">Template for standard AI enhancement (Ctrl+R). Use {htmlContent} placeholder.</p>
                            <textarea id="user-prompt-textarea" class="prompt-textarea prompt-full-width" placeholder="Enter user prompt template for standard enhancement..."></textarea>
                        </div>
                        
                        <div id="message-prompt" class="prompt-mode-content" style="display: none;">
                            <p class="prompt-help">Template for custom message enhancement (replacing mode). Use {htmlContent} and {user_message} placeholders.</p>
                            <textarea id="user-prompt-with-message-textarea" class="prompt-textarea prompt-full-width" placeholder="Enter user prompt template for custom messages..."></textarea>
                        </div>
                        
                        <div id="edit-message-prompt" class="prompt-mode-content" style="display: none;">
                            <p class="prompt-help">Template for editing existing code. Use {htmlContent} (with existing code) and {user_message} placeholders.</p>
                            <textarea id="user-prompt-edit-message-textarea" class="prompt-textarea prompt-full-width" placeholder="Enter user prompt template for editing existing code..."></textarea>
                        </div>
                    </div>
                    
                    <div class="prompt-section">
                        <h4>System Prompt</h4>
                        <p class="prompt-help">Instructions that define the AI's role and behavior constraints.</p>
                        <textarea id="system-prompt-textarea" class="prompt-textarea prompt-full-width" placeholder="Enter system prompt..."></textarea>
                    </div>
                </div>
            </div>
        `;

        // Get DOM references
        systemPromptTextarea = container.querySelector('#system-prompt-textarea');
        userPromptTextarea = container.querySelector('#user-prompt-textarea');
        userPromptWithMessageTextarea = container.querySelector('#user-prompt-with-message-textarea');
        userPromptEditMessageTextarea = container.querySelector('#user-prompt-edit-message-textarea');
        apiKeyInput = container.querySelector('#api-key-input');
        modelInput = container.querySelector('#model-input');
        temperatureInput = container.querySelector('#temperature-input');
        maxTokensInput = container.querySelector('#max-tokens-input');
        maxThinkingTokensInput = container.querySelector('#max-thinking-tokens-input');
        const resetButton = container.querySelector('#reset-defaults-btn');

        if (!systemPromptTextarea || !userPromptTextarea || !userPromptWithMessageTextarea || !userPromptEditMessageTextarea || !apiKeyInput || !modelInput) {
            console.error('Settings tab elements not found');
            return;
        }

        setupPromptModeToggle(container);

        setupEventListeners(resetButton);
        loadSettings();
    }

    // Setup prompt mode toggle functionality
    function setupPromptModeToggle(container) {
        const toggleButtons = container.querySelectorAll('.prompt-mode-toggle .mode-toggle-btn');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                switchPromptMode(mode);
            });
        });
    }

    // Switch between prompt modes
    function switchPromptMode(mode) {
        currentPromptMode = mode;
        
        // Update toggle button states
        const toggleButtons = tabContent.querySelectorAll('.prompt-mode-toggle .mode-toggle-btn');
        toggleButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('mode-active');
            } else {
                btn.classList.remove('mode-active');
            }
        });

        // Show/hide content sections
        const noMessageContent = tabContent.querySelector('#no-message-prompt');
        const messageContent = tabContent.querySelector('#message-prompt');
        const editMessageContent = tabContent.querySelector('#edit-message-prompt');

        // Hide all first
        noMessageContent.style.display = 'none';
        messageContent.style.display = 'none';
        editMessageContent.style.display = 'none';

        // Show selected mode
        if (mode === 'no-message') {
            noMessageContent.style.display = 'block';
        } else if (mode === 'message') {
            messageContent.style.display = 'block';
        } else if (mode === 'edit-message') {
            editMessageContent.style.display = 'block';
        }
    }

    // Setup event listeners
    function setupEventListeners(resetButton) {
        // Auto-save on input changes (debounced)
        systemPromptTextarea.addEventListener('input', debounce(saveSettings, 500));
        userPromptTextarea.addEventListener('input', debounce(saveSettings, 500));
        userPromptWithMessageTextarea.addEventListener('input', debounce(saveSettings, 500));
        userPromptEditMessageTextarea.addEventListener('input', debounce(saveSettings, 500));
        apiKeyInput.addEventListener('input', debounce(saveSettings, 500));
        modelInput.addEventListener('input', debounce(saveSettings, 500));
        temperatureInput.addEventListener('input', debounce(saveSettings, 500));
        maxTokensInput.addEventListener('input', debounce(saveSettings, 500));
        maxThinkingTokensInput.addEventListener('input', debounce(saveSettings, 500));

        // Reset button
        if (resetButton) {
            resetButton.addEventListener('click', resetToDefaults);
        }
    }

    // Debounce helper function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Load settings from localStorage or use defaults
    function loadSettings() {
        const settings = getSettings();
        
        systemPromptTextarea.value = settings.systemPrompt;
        userPromptTextarea.value = settings.userPrompt;
        userPromptWithMessageTextarea.value = settings.userPromptWithMessage;
        userPromptEditMessageTextarea.value = settings.userPromptEditMessage;
        apiKeyInput.value = settings.apiKey;
        modelInput.value = settings.model;
        temperatureInput.value = settings.temperature;
        maxTokensInput.value = settings.maxTokens;
        maxThinkingTokensInput.value = settings.maxThinkingTokens;
    }

    // Save current settings to localStorage
    function saveSettings() {
        const settings = {
            systemPrompt: systemPromptTextarea.value,
            userPrompt: userPromptTextarea.value,
            userPromptWithMessage: userPromptWithMessageTextarea.value,
            userPromptEditMessage: userPromptEditMessageTextarea.value,
            apiKey: apiKeyInput.value,
            model: modelInput.value,
            temperature: parseFloat(temperatureInput.value) || 0,
            maxTokens: parseInt(maxTokensInput.value) || 10000,
            maxThinkingTokens: parseInt(maxThinkingTokensInput.value) || 2000
        };

        localStorage.setItem('canvasAISettings', JSON.stringify(settings));
        console.log('AI settings saved to localStorage');
    }

    // Get settings from localStorage or return defaults
    function getSettings() {
        try {
            const stored = localStorage.getItem('canvasAISettings');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults to ensure all properties exist
                return { ...DEFAULTS, ...parsed };
            }
        } catch (error) {
            console.warn('Error loading settings from localStorage:', error);
        }
        return { ...DEFAULTS };
    }

    // Reset all settings to hardcoded defaults
    function resetToDefaults() {
        if (confirm('Reset all AI settings to default values? This cannot be undone.')) {
            localStorage.removeItem('canvasAISettings');
            loadSettings();
            console.log('AI settings reset to defaults');
        }
    }

    // Called when tab becomes visible
    function onTabShow() {
        // Refresh settings in case they were changed elsewhere
        loadSettings();
        console.log('Settings/Context tab shown');
    }

    // Called when tab becomes hidden
    function onTabHide() {
        // Save any pending changes
        saveSettings();
        console.log('Settings/Context tab hidden');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API
    window.settingsContextTab = {
        getSettings: getSettings,
        saveSettings: saveSettings,
        resetToDefaults: resetToDefaults,
        DEFAULTS: DEFAULTS
    };

    console.log('Settings/Context Tab module loaded successfully');

})();