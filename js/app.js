// Initialize the canvas with some frames
window.addEventListener('load', () => {
    initializeCanvas();
    
    // Add keyboard shortcut to create new frames
    document.addEventListener('keydown', (e) => {
        if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            const x = Math.random() * (window.innerWidth - 300);
            const y = Math.random() * (window.innerHeight - 200);
            createFrame(x, y);
        }
        
        // Reset zoom with Cmd/Ctrl + 0
        if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            window.canvasZoom.resetZoom();
        }
        
        // Delete selected elements with Backspace
        if (e.key === 'Backspace') {
            // Protect situations where user is typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
                return; // Allow normal backspace behavior in text fields
            }
            
            // Get selected elements
            const selectedElements = window.getSelectedElements ? window.getSelectedElements() : [];
            
            if (selectedElements.length > 0) {
                e.preventDefault(); // Prevent browser back navigation
                
                // Remove each selected element from DOM
                selectedElements.forEach(element => {
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                });
                
                // Clear selection
                if (window.clearSelection) {
                    window.clearSelection();
                }
            }
        }
    });
});