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
    });
});