(() => {
    const icons = [
        'academic-cap', 'adjustments-horizontal', 'archive-box', 'arrow-down-circle',
        'arrow-right', 'calendar', 'camera', 'chart-bar', 'check-circle', 'cloud',
        'code-bracket', 'heart', 'home', 'magnifying-glass', 'star', 'user'
    ];

    let resultsContainer;

    function iconUrl(name) {
        return `https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/${name}.svg`;
    }

    function updateResults(query) {
        resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        resultsContainer.classList.add('icons');
        resultsContainer.innerHTML = '';
        const q = query.toLowerCase();
        const matches = icons.filter(name => name.includes(q));
        matches.forEach((name, idx) => {
            const div = document.createElement('div');
            div.className = 'result';
            div.dataset.icon = name;
            div.setAttribute('data-selectable', 'false');
            const img = document.createElement('img');
            img.src = iconUrl(name);
            img.alt = name;
            img.width = 24;
            img.height = 24;
            div.appendChild(img);
            if (idx === 0) div.classList.add('selected');
            div.addEventListener('click', () => placeIcon(name));
            resultsContainer.appendChild(div);
        });
    }

    function placeIcon(name) {
        const img = document.createElement('img');
        img.src = iconUrl(name);
        img.className = 'icon-element free-floating';
        img.width = 24;
        img.height = 24;
        window.startPlacementWithElement(img);
        if (window.leftSidebar) window.leftSidebar.collapse();
    }

    function handleEnter() {
        const selected = document.querySelector('#search-results .result.selected');
        if (selected) {
            placeIcon(selected.dataset.icon);
        }
    }

    window.iconSearch = { updateResults, handleEnter };
})();
