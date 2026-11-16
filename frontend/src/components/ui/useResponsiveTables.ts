import { useEffect } from 'react';

/**
 * Makes every data table on the page phone-friendly without touching each page:
 * - adds class "rt" and a data-label (taken from the column header) to every cell,
 * - CSS in index.css then turns each row into a card below 768px.
 * Tables can opt out with data-no-stack.
 * Runs on route changes and whenever rows are added (MutationObserver), throttled to one frame.
 */
export function labelTables(root: ParentNode = document) {
  root.querySelectorAll<HTMLTableElement>('table:not([data-no-stack])').forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim());
    if (!headers.length) return;
    table.classList.add('rt');
    table.querySelectorAll('tbody tr').forEach((tr) => {
      let col = 0;
      Array.from(tr.children).forEach((cell) => {
        const td = cell as HTMLTableCellElement;
        const label = headers[col] ?? '';
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
        col += td.colSpan || 1;
      });
    });
    // keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable)
    const scroller = table.closest('.overflow-x-auto, .overflow-auto') as HTMLElement | null;
    if (scroller && !scroller.hasAttribute('tabindex')) {
      scroller.tabIndex = 0;
      scroller.setAttribute('role', 'region');
      scroller.setAttribute('aria-label', headers.slice(0, 3).join(', ') + ' table');
    }
    // the old "scroll right to see all columns" hints are obsolete on phones
    const wrapper = table.parentElement;
    wrapper?.parentElement?.querySelectorAll('div,span,p').forEach((el) => {
      if (/scroll right/i.test(el.textContent || '') && el.children.length <= 2) el.classList.add('rt-scroll-hint');
    });
  });
}

/**
 * Gives every form control an accessible name for screen readers when the page did not:
 * - a <label> right before the control (common pattern here, but without htmlFor) → aria-label,
 * - row checkboxes in tables → "Select <first text cell>", header checkbox → "Select all",
 * - selects without a label → their placeholder option ("-- Choose Asset --") or "Filter".
 * Never overrides an existing label, aria-label or aria-labelledby.
 */
export function labelFormControls(root: ParentNode = document) {
  const clean = (t: string | null | undefined) => (t || '').replace(/\s+/g, ' ').replace(/[*:]+\s*$/, '').trim();
  root.querySelectorAll<HTMLElement>('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').forEach((el) => {
    if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
    const id = el.id;
    if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return;
    if (el.closest('label')) return;

    let name = '';
    const prev = el.previousElementSibling;
    if (prev?.tagName === 'LABEL') name = clean(prev.textContent);
    // label placed just before a wrapper (up to 2 levels up), e.g. colour picker + hex field
    let node: HTMLElement | null = el;
    for (let depth = 0; !name && node && depth < 2; depth++) {
      const parent: HTMLElement | null = node.parentElement;
      const before = parent?.previousElementSibling;
      if (before?.tagName === 'LABEL') {
        const controls = parent!.querySelectorAll('input,select,textarea');
        const base = clean(before.textContent);
        name = controls.length === 1 ? base : `${base}${(el as HTMLInputElement).type === 'color' ? ' (picker)' : ''}`;
      }
      node = parent;
    }
    if (!name && el instanceof HTMLInputElement && el.type === 'checkbox') {
      if (el.closest('thead')) name = 'Select all';
      else {
        const row = el.closest('tr');
        const firstText = row && Array.from(row.querySelectorAll('td')).map((td) => clean(td.textContent)).find(Boolean);
        name = firstText ? `Select ${firstText.slice(0, 60)}` : 'Select row';
      }
    }
    if (!name && el instanceof HTMLSelectElement) {
      name = clean(el.options[0]?.text).replace(/^-+\s*|\s*-+$/g, '').replace(/\(\d+\)$/, '').trim() || 'Filter';
    }
    if (!name) name = clean((el as HTMLInputElement).placeholder || el.getAttribute('title'));
    if (name) el.setAttribute('aria-label', name);
  });
}

export function useResponsiveTables(dep?: unknown) {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        labelTables();
        labelFormControls();
      });
    };
    run();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.addedNodes.length)) run();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [dep]);
}
