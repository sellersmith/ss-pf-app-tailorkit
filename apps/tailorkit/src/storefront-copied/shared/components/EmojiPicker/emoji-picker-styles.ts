/** Styles for the inline emoji picker row shown below text input */
export const emojiPickerStyles = `
.emtlkit-emoji-picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 0 2px;
}

.emtlkit-emoji-item {
  background: #f6f6f7;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 4px 6px;
  transition: background 0.1s ease, border-color 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emtlkit-emoji-item:hover {
  background: #edeeef;
  border-color: #c9cccf;
}

.emtlkit-emoji-item:active {
  background: #e4e5e7;
}

/* "View all (N)" / "Show less" toggle — compact, centered, subtle.
   Mirrored here so emoji picker renders correctly even when ImageOptionSet
   stylesheet is not loaded on the page. */
tailorkit-emoji-picker .emtlkit-view-all-toggle {
  display: block;
  margin: 6px auto 2px;
  padding: 4px 10px;
  background: none;
  border: none;
  color: var(--emtlkit-text-color, #303030);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0.7;
  text-decoration: none;
  transition: opacity 0.15s ease;
}

tailorkit-emoji-picker .emtlkit-view-all-toggle:hover,
tailorkit-emoji-picker .emtlkit-view-all-toggle:focus {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 2px;
}

tailorkit-emoji-picker .emtlkit-view-all-toggle:focus-visible {
  outline: 2px solid var(--emtlkit-focus-color, #005bd3);
  outline-offset: 2px;
  border-radius: 2px;
}
`
