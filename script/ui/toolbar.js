export function bindToolbar({ root, actions }) {
  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }

    const action = trigger.dataset.action;
    actions[action]?.();
  });
}

export function updateToolbarState(root, selectionState, { emptyLabel, formatSelection }) {
  root.querySelectorAll('[data-requires-selection="true"]').forEach((element) => {
    if (element instanceof HTMLButtonElement) {
      element.disabled = !selectionState.hasSelection;
    }
  });

  const summary = root.querySelector('[data-selection-label]');
  if (!(summary instanceof HTMLElement)) {
    return;
  }

  summary.textContent = selectionState.hasSelection
    ? formatSelection(selectionState)
    : emptyLabel;
}
