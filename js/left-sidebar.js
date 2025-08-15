(() => {
    const sidebar = document.createElement('div');
    sidebar.id = 'left-sidebar';
    sidebar.setAttribute('data-selectable', 'false');

    const elementsBtn = document.createElement('button');
    elementsBtn.id = 'elements-search-btn';
    elementsBtn.title = 'Search Elements';
    elementsBtn.setAttribute('data-selectable', 'false');
    elementsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';

    const iconsBtn = document.createElement('button');
    iconsBtn.id = 'icon-search-btn';
    iconsBtn.title = 'Search Icons';
    iconsBtn.setAttribute('data-selectable', 'false');
    iconsBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    sidebar.appendChild(elementsBtn);
    sidebar.appendChild(iconsBtn);

    const searchContainer = document.createElement('div');
    searchContainer.id = 'search-container';
    const input = document.createElement('input');
    input.id = 'search-input';
    input.type = 'text';
    input.placeholder = 'Search...';
    const results = document.createElement('div');
    results.id = 'search-results';
    results.setAttribute('data-selectable', 'false');
    searchContainer.appendChild(input);
    searchContainer.appendChild(results);
    sidebar.appendChild(searchContainer);

    document.body.appendChild(sidebar);

    let activeType = null;

    function open(type) {
        activeType = type;
        sidebar.classList.add('expanded');
        input.value = '';
        results.innerHTML = '';
        if (type === 'elements' && window.elementSearch) {
            window.elementSearch.updateResults('');
        } else if (type === 'icons' && window.iconSearch) {
            window.iconSearch.updateResults('');
        }
        setTimeout(() => input.focus(), 0);
    }

    function collapse() {
        sidebar.classList.remove('expanded');
        activeType = null;
        input.blur();
    }

    elementsBtn.addEventListener('click', () => open('elements'));
    iconsBtn.addEventListener('click', () => open('icons'));

    input.addEventListener('input', () => {
        if (activeType === 'elements' && window.elementSearch) {
            window.elementSearch.updateResults(input.value);
        } else if (activeType === 'icons' && window.iconSearch) {
            window.iconSearch.updateResults(input.value);
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (activeType === 'elements' && window.elementSearch) {
                window.elementSearch.handleEnter();
            } else if (activeType === 'icons' && window.iconSearch) {
                window.iconSearch.handleEnter();
            }
        } else if (e.key === 'Escape') {
            collapse();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (window.canvasMode && window.canvasMode.isInteractiveMode()) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true' || (window.codeEditor && window.codeEditor.isActive())) return;
        if (window.textEditing && window.textEditing.getCurrentlyEditingElement && window.textEditing.getCurrentlyEditingElement()) return;
        if (window.isInPlacementMode && window.isInPlacementMode()) return;
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        if (e.key.toLowerCase() === 'e') {
            e.preventDefault();
            open('elements');
        } else if (e.key.toLowerCase() === 'x') {
            e.preventDefault();
            open('icons');
        }
    });

    window.leftSidebar = { open, collapse };
})();
