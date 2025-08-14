(() => {
    const elements = [
        { name: 'Frame', type: 'frame' },
        { name: 'Element Frame', type: 'element-frame' },
        { name: 'Text', type: 'text' },
        { name: 'Line', type: 'line' },
        { name: 'Circle', type: 'circle' },
        { name: 'Button', type: 'button' },
        { name: 'Input', type: 'input' }
    ];

    let resultsContainer;

    function updateResults(query) {
        resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        resultsContainer.classList.remove('icons');
        resultsContainer.innerHTML = '';
        const q = query.toLowerCase();
        const matches = elements.filter(e => e.name.toLowerCase().includes(q));
        matches.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'result';
            div.textContent = item.name;
            div.dataset.type = item.type;
            div.setAttribute('data-selectable', 'false');
            if (idx === 0) div.classList.add('selected');
            div.addEventListener('click', () => startPlacement(item.type));
            resultsContainer.appendChild(div);
        });
    }

    function startPlacement(type) {
        if (window.startElementPlacement) {
            window.startElementPlacement(type);
        }
        if (window.leftSidebar) window.leftSidebar.collapse();
    }

    function handleEnter() {
        const selected = document.querySelector('#search-results .result.selected');
        if (selected) {
            startPlacement(selected.dataset.type);
        }
    }

    window.elementSearch = { updateResults, handleEnter };
})();
