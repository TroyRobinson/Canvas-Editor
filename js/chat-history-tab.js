/**
 * Chat/History Tab Module
 * 
 * Displays enhancement request history as cards showing time, status, and frame details.
 * Newest requests appear at the bottom, oldest at the top.
 */

(function() {
    'use strict';

    // State management
    let tabContent = null;
    let historyScroll = null;
    let historyList = null;
    let enhancementHistory = []; // Array of enhancement request entries
    let currentSelectedFrame = null; // Track the currently selected frame
    let enhancementMode = 'editing'; // 'editing' or 'replacing'

    // Initialize the chat/history tab
    function init() {
        if (!window.rightPaneManager) {
            console.error('Right Pane Manager not available');
            return;
        }

        // Register with the right pane manager
        tabContent = window.rightPaneManager.registerTab('chat-history', {
            title: 'Chat/History',
            onInit: initializeTab,
            onShow: onTabShow,
            onHide: onTabHide
        });

        // Set up event listeners for enhancement events
        setupEnhancementEventListeners();

        // Make Chat/History the default active tab on load
        if (window.rightPaneManager &&
            typeof window.rightPaneManager.getActiveTab === 'function' &&
            !window.rightPaneManager.getActiveTab()) {
            window.rightPaneManager.switchToTab('chat-history');
        }
    }

    // Initialize tab content when first created
    function initializeTab(container) {
        // Create the tab content structure
        container.innerHTML = `
            <div class="enhancement-history-header">
                <h3>Enhancement History</h3>
                <p class="history-subtitle">AI frame enhancement requests (Ctrl+R)</p>
            </div>
            <div class="enhancement-history-scroll">
                <div class="enhancement-history-container" id="enhancement-history-list">
                    <div class="empty-history">
                        <p>No enhancement requests yet.</p>
                        <p><em>Select a frame and press Ctrl+R to get started!</em></p>
                    </div>
                </div>
            </div>
            <div class="message-input-section">
                <div class="message-controls">
                    <div class="enhancement-mode-toggle">
                        <button class="mode-toggle-btn mode-active" data-mode="editing" data-selectable="false">Editing</button>
                        <button class="mode-toggle-btn" data-mode="replacing" data-selectable="false">Replacing</button>
                    </div>
                </div>
                <div class="message-input-container">
                    <textarea
                        id="custom-message-input"
                        class="message-textarea"
                        placeholder="Describe how to modify the existing code in the selected frame..."
                        rows="2"
                        data-selectable="false"></textarea>
                    <button
                        id="send-message-btn"
                        class="send-message-button"
                        title="Send Custom Enhancement Request"
                        data-selectable="false">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22,2 15,22 11,13 2,9"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        historyScroll = container.querySelector('.enhancement-history-scroll');
        historyList = container.querySelector('#enhancement-history-list');
        
        // Setup message input functionality
        setupMessageInput(container);
        
        // Setup enhancement mode toggle
        setupEnhancementModeToggle(container);
    }

    // Setup message input functionality
    function setupMessageInput(container) {
        const messageInput = container.querySelector('#custom-message-input');
        const sendButton = container.querySelector('#send-message-btn');

        if (!messageInput || !sendButton) {
            console.error('Message input elements not found');
            return;
        }

        // Send message on button click
        sendButton.addEventListener('click', () => {
            sendCustomMessage(messageInput.value.trim());
        });

        // Send message on Enter key (but allow Shift+Enter for new lines)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCustomMessage(messageInput.value.trim());
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        });
    }

    // Setup enhancement mode toggle functionality
    function setupEnhancementModeToggle(container) {
        const toggleButtons = container.querySelectorAll('.enhancement-mode-toggle .mode-toggle-btn');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                switchEnhancementMode(mode);
            });
        });
    }

    // Switch between enhancement modes
    function switchEnhancementMode(mode) {
        enhancementMode = mode;
        
        // Update toggle button states
        const toggleButtons = tabContent.querySelectorAll('.enhancement-mode-toggle .mode-toggle-btn');
        toggleButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('mode-active');
            } else {
                btn.classList.remove('mode-active');
            }
        });

        // Update placeholder text based on mode
        const messageInput = tabContent.querySelector('#custom-message-input');
        if (messageInput) {
            if (mode === 'editing') {
                messageInput.placeholder = 'Describe how to modify the existing code in the selected frame...';
            } else {
                messageInput.placeholder = 'Describe what you want to add or change in the selected frame...';
            }
        }

        console.log('Enhancement mode switched to:', mode);
    }

    // Send custom enhancement message
    function sendCustomMessage(message) {
        if (!message) {
            alert('Please enter a message describing what you want to enhance.');
            return;
        }

        // Get currently selected frame
        const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
        let selectedFrame = null;

        if (selectedElements.length > 0) {
            const element = selectedElements[0];
            if (element.classList.contains('frame')) {
                selectedFrame = element;
            } else {
                selectedFrame = element.closest('.frame');
            }
        }

        if (!selectedFrame) {
            alert('Please select a frame to enhance with your custom message.');
            return;
        }

        // Trigger custom enhancement based on mode
        if (window.llmManager) {
            if (enhancementMode === 'editing' && window.llmManager.enhanceFrameWithEditMessage) {
                window.llmManager.enhanceFrameWithEditMessage(selectedFrame, message);
            } else if (window.llmManager.enhanceFrameWithCustomMessage) {
                window.llmManager.enhanceFrameWithCustomMessage(selectedFrame, message);
            } else {
                console.error('LLM Manager custom message function not available');
                alert('Custom enhancement feature not available. Please check console for errors.');
                return;
            }
            
            // Clear the message input
            const messageInput = tabContent.querySelector('#custom-message-input');
            if (messageInput) {
                messageInput.value = '';
                messageInput.style.height = 'auto';
            }
        } else {
            console.error('LLM Manager not available');
            alert('Custom enhancement feature not available. Please check console for errors.');
        }
    }

    // Set up event listeners for enhancement lifecycle events
    function setupEnhancementEventListeners() {
        document.addEventListener('enhancementStarted', handleEnhancementStarted);
        document.addEventListener('enhancementCompleted', handleEnhancementCompleted);
        document.addEventListener('enhancementFailed', handleEnhancementFailed);
        
        // Listen for selection changes to update frame filtering
        window.addEventListener('selectionChanged', handleSelectionChange);
    }

    // Handle selection changes to update frame filtering
    function handleSelectionChange() {
        const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
        
        let selectedFrame = null;
        if (selectedElements.length > 0) {
            const element = selectedElements[0];
            // Check if selected element is a frame
            if (element.classList.contains('frame')) {
                selectedFrame = element;
            } else {
                // Find parent frame
                selectedFrame = element.closest('.frame');
            }
        }

        // Update current frame and re-render if changed
        if (selectedFrame !== currentSelectedFrame) {
            currentSelectedFrame = selectedFrame;
            renderHistory();
        }
    }

    // Handle enhancement started event
    function handleEnhancementStarted(event) {
        const entry = {
            id: event.detail.id,
            frameId: event.detail.frameId,
            frameTitle: event.detail.frameTitle,
            timestamp: event.detail.timestamp,
            status: 'processing',
            startTime: event.detail.timestamp,
            customMessage: event.detail.customMessage || null,
            editMode: event.detail.editMode || false
        };

        addHistoryEntry(entry);
    }

    // Handle enhancement completed event
    function handleEnhancementCompleted(event) {
        const entry = {
            id: event.detail.id,
            frameId: event.detail.frameId,
            frameTitle: event.detail.frameTitle,
            timestamp: event.detail.timestamp,
            completedAt: event.detail.completedAt,
            status: 'success',
            duration: event.detail.completedAt - event.detail.timestamp,
            customMessage: event.detail.customMessage || null,
            editMode: event.detail.editMode || false
        };

        updateHistoryEntry(entry);
    }

    // Handle enhancement failed event
    function handleEnhancementFailed(event) {
        const entry = {
            id: event.detail.id,
            frameId: event.detail.frameId,
            frameTitle: event.detail.frameTitle,
            timestamp: event.detail.timestamp,
            completedAt: event.detail.completedAt,
            status: 'error',
            error: event.detail.error,
            duration: event.detail.completedAt - event.detail.timestamp,
            customMessage: event.detail.customMessage || null,
            editMode: event.detail.editMode || false
        };

        updateHistoryEntry(entry);
    }

    // Add a new history entry
    function addHistoryEntry(entry) {
        enhancementHistory.push(entry);
        renderHistory();
    }

    // Update an existing history entry
    function updateHistoryEntry(updatedEntry) {
        const index = enhancementHistory.findIndex(entry => entry.id === updatedEntry.id);
        if (index !== -1) {
            enhancementHistory[index] = { ...enhancementHistory[index], ...updatedEntry };
            renderHistory();
        }
    }

    // Render the full history (filtered by current frame)
    function renderHistory() {
        if (!historyList || !historyScroll) return;

        // Update header to show current frame context
        updateHistoryHeader();

        // Clear existing content
        historyList.innerHTML = '';

        // Only show history if a frame is selected
        if (!currentSelectedFrame) {
            historyList.innerHTML = `
                <div class="empty-history">
                    <p>Select a frame to view its enhancement history.</p>
                    <p><em>Click on a frame, then press Ctrl+R to get started!</em></p>
                </div>
            `;
            return;
        }

        // Filter history by current selected frame
        const filteredHistory = enhancementHistory.filter(entry => entry.frameId === currentSelectedFrame.id);

        if (filteredHistory.length === 0) {
            const emptyMessage = `No enhancement requests for "${currentSelectedFrame.querySelector('.frame-title')?.textContent || 'this frame'}" yet.`;
                
            historyList.innerHTML = `
                <div class="empty-history">
                    <p>${emptyMessage}</p>
                    <p><em>Press Ctrl+R to enhance this frame!</em></p>
                </div>
            `;
            return;
        }

        // Sort history: oldest at top, newest at bottom
        const sortedHistory = [...filteredHistory].sort((a, b) => a.timestamp - b.timestamp);

        // Create cards for each entry
        sortedHistory.forEach(entry => {
            const card = createHistoryCard(entry);
            historyList.appendChild(card);
        });

        // Scroll to bottom to show newest entries
        historyScroll.scrollTop = historyScroll.scrollHeight;
    }

    // Update the history header to show current frame context
    function updateHistoryHeader() {
        const headerElement = tabContent?.querySelector('.enhancement-history-header h3');
        const subtitleElement = tabContent?.querySelector('.history-subtitle');
        
        if (!headerElement || !subtitleElement) return;

        if (currentSelectedFrame) {
            const frameTitle = currentSelectedFrame.querySelector('.frame-title')?.textContent || 'Untitled Frame';
            headerElement.textContent = `Enhancement History: ${frameTitle}`;
            subtitleElement.textContent = 'AI frame enhancement requests (Ctrl+R) for this frame';
        } else {
            headerElement.textContent = 'Enhancement History';
            subtitleElement.textContent = 'Select a frame to view its enhancement history';
        }
    }

    // Create a history card element
    function createHistoryCard(entry) {
        const card = document.createElement('div');
        card.className = `history-card status-${entry.status}`;
        card.dataset.entryId = entry.id;
        card.dataset.selectable = 'false'; // Prevent canvas selection system

        const timeStr = formatTime(entry.timestamp);
        const statusIcon = getStatusIcon(entry.status);
        const statusText = getStatusText(entry.status);
        const durationText = entry.duration ? ` (${Math.round(entry.duration / 1000)}s)` : '';

        // Determine what to show in the card body
        const displayContent = entry.customMessage ? entry.customMessage : entry.frameTitle;
        const modeIndicator = entry.editMode ? ' (Edit)' : '';
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-status">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}${durationText}${modeIndicator}</span>
                </div>
                <div class="card-time">${timeStr}</div>
            </div>
            <div class="card-body">
                <div class="card-content">${displayContent}</div>
                ${entry.customMessage ? `<div class="frame-reference">Frame: ${entry.frameTitle}</div>` : ''}
                ${entry.error ? `<div class="error-message">${entry.error}</div>` : ''}
            </div>
        `;

        return card;
    }

    // Format timestamp for display
    function formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        
        return time.toLocaleDateString() + ' ' + time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    // Get status icon
    function getStatusIcon(status) {
        switch (status) {
            case 'processing': return '⏳';
            case 'success': return '✅';
            case 'error': return '❌';
            default: return '❓';
        }
    }

    // Get status text
    function getStatusText(status) {
        switch (status) {
            case 'processing': return 'Processing';
            case 'success': return 'Completed';
            case 'error': return 'Failed';
            default: return 'Unknown';
        }
    }

    // Called when tab becomes visible
    function onTabShow() {
        renderHistory();
        console.log('Enhancement History tab shown');
    }

    // Called when tab becomes hidden
    function onTabHide() {
        console.log('Enhancement History tab hidden');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API
    window.chatHistoryTab = {
        addHistoryEntry: addHistoryEntry,
        updateHistoryEntry: updateHistoryEntry,
        getHistory: () => [...enhancementHistory],
        clearHistory: () => {
            enhancementHistory = [];
            renderHistory();
        }
    };

})();