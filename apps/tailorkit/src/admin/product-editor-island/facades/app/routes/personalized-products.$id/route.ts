/**
 * Type-only clientLoader facade for ProductEditor compile prep.
 * Runtime loading is provided by PageFly's TailorKit loader context.
 */
export async function clientLoader() {
  return {
    id: '',
    mockupId: '',
    integration: null as unknown,
    tab: '',
    printAreaId: '',
    templateId: '',
    viewId: '',
  }
}
