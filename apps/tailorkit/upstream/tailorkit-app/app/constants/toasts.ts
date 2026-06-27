export const TOAST = {
  /**
   * Shared/common toast keys.
   *
   * Shopify toast best practices: keep messages short (ideally <= 3 words), affirmative,
   * and avoid using toast for persistent/critical errors.
   */
  COMMON: {
    /** Generic fallback for any dynamic/server error message we should not surface. */
    ERROR_GENERIC: 'toast.error.generic',

    /** Clipboard / copy */
    COPYING: 'toast.info.copying',
    COPIED: 'toast.success.copied',
    COPIED_TO_CLIPBOARD: 'toast.success.copiedToClipboard',
    CLIPBOARD_BLOCKED: 'toast.error.clipboardBlocked',

    /** Copy/paste actions */
    ELEMENT_COPIED: 'toast.success.elementCopied',
    ELEMENTS_COPIED: 'toast.success.elementsCopied',
    ELEMENT_PASTED: 'toast.success.elementPasted',
    ELEMENTS_PASTED: 'toast.success.elementsPasted',
    STYLE_COPIED: 'toast.success.styleCopied',
    STYLE_PASTED: 'toast.success.stylePasted',

    /** Generic status */
    UPDATED: 'toast.success.updated',
    CHANGES_DISCARDED: 'toast.success.changesDiscarded',
    UNINSTALLED: 'toast.success.uninstalled',
    EXPORTED: 'toast.success.exported',

    /** File / upload validation */
    FILE_REQUIRED: 'toast.error.fileRequired',
    INVALID_FILE: 'toast.error.invalidFile',
    SINGLE_FILE_ONLY: 'toast.error.singleFileOnly',
    PSD_REQUIRED: 'toast.error.psdRequired',

    /** Common success */
    TEMPLATE_REPLACED: 'toast.success.templateReplaced',
    MASK_CREATED: 'toast.success.maskCreated',

    /** Language */
    LANGUAGE_UPDATING: 'toast.info.languageUpdating',
    LANGUAGE_UPDATED: 'toast.success.languageUpdated',
    LANGUAGE_UPDATE_FAILED: 'toast.error.languageUpdateFailed',

    /** Selection constraints */
    MAXIMUM_IMAGES_SELECTED: 'toast.info.maximumImagesSelected',

    /** Product */
    PRODUCT_CREATED: 'toast.success.productCreated',
  },

  SETTINGS: {
    SAVING: 'toast.info.settingsSaving',
    SAVED: 'toast.success.settingsSaved',
    SAVE_FAILED: 'toast.error.settingsSaveFailed',
    CHANGES_SAVED: 'toast.success.changesSaved',
    CHANGES_SAVE_FAILED: 'toast.error.changesSaveFailed',
    ADDON_SAVED: 'toast.success.addonSaved',
    HELPER_NOT_ENABLED: 'toast.error.helperNotEnabled',
    HELPER_NOT_ENABLED_YET: 'toast.error.helperNotEnabledYet',
    HELPER_ENABLED: 'toast.success.helperEnabled',
    HELPER_STATUS_CHECK_FAILED: 'toast.error.helperStatusCheckFailed',
  },

  ADDON: {
    /** Info toasts */
    DUPLICATING: 'toast.info.addonDuplicating',
    DUPLICATING_MULTIPLE: 'toast.info.addonsDuplicating',
    DELETING: 'toast.info.addonDeleting',
    DELETING_MULTIPLE: 'toast.info.addonsDeleting',
    ACTIVATING: 'toast.info.addonActivating',
    ACTIVATING_MULTIPLE: 'toast.info.addonsActivating',
    DEACTIVATING: 'toast.info.addonDeactivating',
    DEACTIVATING_MULTIPLE: 'toast.info.addonsDeactivating',

    /** Success toasts */
    DUPLICATED: 'toast.success.addonDuplicated',
    DUPLICATED_MULTIPLE: 'toast.success.addonsDuplicated',
    DELETED: 'toast.success.addonDeleted',
    DELETED_MULTIPLE: 'toast.success.addonsDeleted',
    ACTIVATED: 'toast.success.addonActivated',
    ACTIVATED_MULTIPLE: 'toast.success.addonsActivated',
    DEACTIVATED: 'toast.success.addonDeactivated',
    DEACTIVATED_MULTIPLE: 'toast.success.addonsDeactivated',
  },

  QUICK_PROMPTS: {
    SAVING: 'toast.info.quickPromptsSaving',
    SAVED: 'toast.success.quickPromptSaved',
    DELETED: 'toast.success.quickPromptDeleted',
  },

  BILLING: {
    COUPON_APPLIED: 'toast.success.couponApplied',
  },

  FEEDBACK: {
    THANKS: 'toast.success.feedbackThanks',
    THANKS_FOR_YOUR_FEEDBACK: 'toast.success.feedbackThanks',
  },

  PRODUCT_EDITOR: {
    INTEGRATION_SAVING: 'toast.info.productSaving',
    INTEGRATION_SAVED: 'toast.success.productSaved',
    INTEGRATION_PUBLISHING: 'toast.info.productPublishing',
    INTEGRATION_PUBLISHED: 'toast.success.productPublished',
    INTEGRATION_PUBLISHING_ALL: 'toast.info.productsPublishing',
    INTEGRATION_PUBLISHED_ALL: 'toast.success.productsPublished',
    INTEGRATION_UNPUBLISHED: 'toast.success.productUnpublished',
    MASK_LAYER_CREATED: 'toast.success.maskLayerCreated',
    AI_MOCKUP_GENERATING: 'toast.info.aiMockupGenerating',
    AI_MOCKUP_GENERATED: 'toast.success.aiMockupGenerated',
    AI_MOCKUP_GENERATE_FAILED: 'toast.error.aiMockupGenerateFailed',
    AI_MOCKUP_DOWNLOADING: 'toast.info.aiMockupDownloading',
    AI_MOCKUP_DOWNLOADED: 'toast.success.aiMockupDownloaded',
    AI_MOCKUP_DOWNLOAD_FAILED: 'toast.error.aiMockupDownloadFailed',
    AI_MOCKUP_APPLYING: 'toast.info.aiMockupApplying',
    AI_MOCKUP_APPLIED: 'toast.success.aiMockupApplied',
    AI_MOCKUP_APPLY_FAILED: 'toast.error.aiMockupApplyFailed',
  },

  ORDER: {
    EXPORTING: 'toast.info.ordersExporting',
    EXPORTED: 'toast.success.ordersExported',
    EMAILED: 'toast.success.ordersEmailed',
    EXPORT_FAILED: 'toast.error.ordersExportFailed',
    FLOW_TRIGGERED_SUCCESSFULLY: 'toast.success.flowTriggeredSuccessfully',
    FLOW_TRIGGER_FAILED: 'toast.error.flowTriggerFailed',
    SYNCING: 'toast.info.orderSyncing',
    SYNCED: 'toast.success.orderSynced',
    SYNC_FAILED: 'toast.error.orderSyncFailed',
  },

  PROVIDER: {
    // Keep legacy property names for easy migration; values point to new toast.* keys.
    INVALID_PROFIT_MARGIN: 'toast.error.profitMarginInvalid',
    SAVING_PROFIT_MARGIN: 'toast.info.profitMarginSaving',
    PROFIT_MARGIN_SAVED: 'toast.success.profitMarginSaved',
    PROFIT_MARGIN_SAVE_FAILED: 'toast.error.profitMarginSaveFailed',

    CONNECTING_FULFILLMENT_PROVIDER: 'toast.info.providerConnecting',
    CONNECTED_FULFILLMENT_PROVIDER: 'toast.success.providerConnected',
    CONNECT_FULFILLMENT_PROVIDER_FAILED: 'toast.error.providerConnectFailed',
    DISCONNECTING_FULFILLMENT_PROVIDER: 'toast.info.providerDisconnecting',
    DISCONNECTED_FULFILLMENT_PROVIDER: 'toast.success.providerDisconnected',
    DISCONNECT_FULFILLMENT_PROVIDER_FAILED: 'toast.error.providerDisconnectFailed',

    SAVING_PRODUCTS: 'toast.info.productsSaving',
    PRODUCTS_SAVED: 'toast.success.productsSaved',
    SAVE_PRODUCTS_FAILED: 'toast.error.productsSaveFailed',

    PREPARING_TO_IMPORT: 'toast.info.importPreparing',
    IMPORTING_TO_SHOPIFY: 'toast.info.importing',
    IMPORTED_TO_SHOPIFY: 'toast.success.imported',
    SOME_PRODUCTS_FAILED_TO_IMPORT: 'toast.error.importPartialFailed',
    PRODUCT_IMPORT_FAILED: 'toast.error.importFailed',
  },

  LIBRARY: {
    DUPLICATING: 'toast.info.itemDuplicating',
    DUPLICATED: 'toast.success.itemDuplicated',
    DUPLICATE_FAILED: 'toast.error.itemDuplicateFailed',
    DELETING: 'toast.info.itemDeleting',
    DELETED: 'toast.success.itemDeleted',
    DELETE_FAILED: 'toast.error.itemDeleteFailed',
  },

  ASSISTANT: {
    GENERATION_FAILED: 'toast.error.generationFailed',
  },

  UNIFIED_EDITOR: {
    /** @deprecated Prefer PRODUCT_EDITOR.* */
    PUBLISHING: 'toast.info.productPublishing',
    /** @deprecated Prefer PRODUCT_EDITOR.* */
    PUBLISHED: 'toast.success.productPublished',
    /** @deprecated Prefer PRODUCT_EDITOR.* */
    PUBLISHING_ALL: 'toast.info.productsPublishing',
    /** @deprecated Prefer PRODUCT_EDITOR.* */
    PUBLISHED_ALL: 'toast.success.productsPublished',
    PUBLISHED_AND_REPUBLISHED_ALL: 'toast.success.productsPublishedAndRepublished',
  },
  TEMPLATE_EDITOR: {
    TEMPLATE_SAVED: 'toast.success.templateSaved',
    SAVING_TEMPLATE: 'toast.info.templateSaving',
    CLIPART_SAVING: 'toast.info.clipartCreating',
    CLIPART_SAVED: 'toast.success.clipartCreated',
    CLIPART_SAVED_ERROR: 'toast.error.clipartCreateFailed',
    REMOVING_BACKGROUND: 'toast.info.backgroundRemoving',
    BACKGROUND_REMOVED: 'toast.success.backgroundRemoved',
    REMOVE_BACKGROUND_FAILED: 'toast.error.backgroundRemoveFailed',
    REPUBLISHING_CHANGES: 'toast.info.republishing',
    CHANGES_REPUBLISHED: 'toast.success.republished',
    TEMPLATE_ERROR: 'toast.error.templateError',

    // Additional toast-only keys that previously lived as raw i18n keys
    SOME_LAYERS_NOT_UPLOADED: 'toast.error.someLayersNotUploaded',
    OPTION_SET_CREATED: 'toast.success.optionSetCreated',
    TRANSPARENT_NOT_FOUND: 'toast.error.transparentNotFound',
    IMAGE_PASTED: 'toast.success.imagePasted',
    IMAGE_REPLACED: 'toast.success.imageReplaced',
  },

  PRINT_AREA: {
    DELETING_TEMPLATE: 'toast.info.templateDeleting',
    TEMPLATE_DELETED: 'toast.success.templateDeleted',
    TEMPLATE_DELETE_FAILED: 'toast.error.templateDeleteFailed',
  },
  INTEGRATED_EDITOR: {
    VARIANTS_UPDATED: 'toast.success.variantsUpdated',
  },
  LIBRARY_LISTING: {
    /** @deprecated Prefer LIBRARY.* */
    DUPLICATING: 'toast.info.itemDuplicating',
    /** @deprecated Prefer LIBRARY.* */
    DUPLICATE_FAILED: 'toast.error.itemDuplicateFailed',
    /** @deprecated Prefer LIBRARY.* */
    DUPLICATED: 'toast.success.itemDuplicated',
    /** @deprecated Prefer LIBRARY.* */
    DELETING: 'toast.info.itemDeleting',
    /** @deprecated Prefer LIBRARY.* */
    DELETE_FAILED: 'toast.error.itemDeleteFailed',
    /** @deprecated Prefer LIBRARY.* */
    DELETED: 'toast.success.itemDeleted',
  },
  INTEGRATION_LISTING: {
    DISINTEGRATING_TEMPLATE: 'toast.info.templateDisintegrating',
    DISINTEGRATING_TEMPLATE_COMPLETED: 'toast.success.templateDisintegrated',
    RESETTING_INTEGRATE_TEMPLATE: 'toast.info.templateResetting',
    RESETTING_INTEGRATE_TEMPLATE_COMPLETED: 'toast.success.templateReset',
    DELETING_INTEGRATE_MOCKUP: 'toast.info.integrationDeleting',
    DELETING_INTEGRATE_MOCKUP_COMPLETED: 'toast.success.integrationDeleted',
  },
  ORDER_LISTING: {},
}
