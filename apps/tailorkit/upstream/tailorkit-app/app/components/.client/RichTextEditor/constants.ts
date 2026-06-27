export const DEFAULT_RICH_TEXT_EDITOR_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline', 'blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
    ['link'],
    ['clean'],
  ],
  clipboard: {
    matchVisual: false, // Needed to avoid this glitch: https://github.com/slab/quill/issues/2905
  },
}
