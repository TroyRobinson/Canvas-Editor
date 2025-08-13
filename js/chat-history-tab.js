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
    let historyContainer = null;
    let enhancementHistory = []; // Array of enhancement request entries
    let currentSelectedFrame = null; // Track the currently selected frame

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
    }

    // Initialize tab content when first created
    function initializeTab(container) {
        // Create the tab content structure
        container.innerHTML = `
            <div class="enhancement-history-header">
                <h3>Enhancement History</h3>
                <p class="history-subtitle">AI frame enhancement requests (Ctrl+R)</p>
            </div>
            <div class="enhancement-history-container" id="enhancement-history-list">
                <div class="empty-history">
                    <p>No enhancement requests yet.</p>
                    <p><em>Select a frame and press Ctrl+R to get started!</em></p>
                </div>
            </div>
        `;

        historyContainer = container.querySelector('#enhancement-history-list');
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
            startTime: event.detail.timestamp
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
            duration: event.detail.completedAt - event.detail.timestamp
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
            duration: event.detail.completedAt - event.detail.timestamp
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
        if (!historyContainer) return;

        // Update header to show current frame context
        updateHistoryHeader();

        // Clear existing content
        historyContainer.innerHTML = '';

        // Filter history by current selected frame
        let filteredHistory = enhancementHistory;
        if (currentSelectedFrame) {
            filteredHistory = enhancementHistory.filter(entry => entry.frameId === currentSelectedFrame.id);
        }

        if (filteredHistory.length === 0) {
            const emptyMessage = currentSelectedFrame 
                ? `No enhancement requests for "${currentSelectedFrame.querySelector('.frame-title')?.textContent || 'this frame'}" yet.`
                : 'No enhancement requests yet.';
                
            historyContainer.innerHTML = `
                <div class="empty-history">
                    <p>${emptyMessage}</p>
                    <p><em>Select a frame and press Ctrl+R to get started!</em></p>
                </div>
            `;
            return;
        }

        // Sort history: oldest at top, newest at bottom
        const sortedHistory = [...filteredHistory].sort((a, b) => a.timestamp - b.timestamp);

        // Create cards for each entry
        sortedHistory.forEach(entry => {
            const card = createHistoryCard(entry);
            historyContainer.appendChild(card);
        });

        // Scroll to bottom to show newest entries
        historyContainer.scrollTop = historyContainer.scrollHeight;
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
            subtitleElement.textContent = 'AI frame enhancement requests (Ctrl+R) - select a frame to filter';
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

        card.innerHTML = `
            <div class="card-header">
                <div class="card-status">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}${durationText}</span>
                </div>
                <div class="card-time">${timeStr}</div>
            </div>
            <div class="card-body">
                <div class="frame-title">${entry.frameTitle}</div>
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