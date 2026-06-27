export type AnnouncementDocument = {
  _id: string
  title: string
  content: string[]
  startAt?: Date
  endAt?: Date
  createdAt: Date
  updatedAt: Date
  status: 'active' | 'inactive'
  tone: 'success' | 'info' | 'warning' | 'critical'
}

export type AnnouncementComponentProps = ComponentProps<any> & {
  t: TFunction
  dataSource: string
  fetchFunction?: (url: string, options?: any) => Promise<any>
}

export type AnnouncementComponentState = ComponentState & {
  announcements: AnnouncementDocument[]
}
