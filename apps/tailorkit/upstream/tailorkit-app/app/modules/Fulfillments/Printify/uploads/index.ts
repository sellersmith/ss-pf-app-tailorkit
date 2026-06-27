import type { FetchDataFunc } from '..'
import type { ArchiveUploadFunc } from './archive'
import archive from './archive'
import type { GetUploadByIdFunc } from './getById'
import getById from './getById'
import type { GetListUploadsFunc } from './getList'
import getList from './getList'
import type { UploadImageFunc } from './uploadImage'
import uploadImage from './uploadImage'

export interface UploadsMethods {
  archive: ArchiveUploadFunc
  getById: GetUploadByIdFunc
  getList: GetListUploadsFunc
  uploadImage: UploadImageFunc
}

/**
 * @see https://developers.printify.com/#uploads
 * @description
 * Artwork added to a Printify Product can be saved in the Media library to be reused on additional products.
 * You can use this API to directly add files to the media library, and later use image IDs when creating or modifying products.
 */

class Uploads implements UploadsMethods {
  /** Retrieve a list of uploaded images */
  getList: GetListUploadsFunc
  /** Retrieve an uploaded image by id */
  getById: GetUploadByIdFunc
  /** Upload an image */
  uploadImage: UploadImageFunc
  /** Archive an uploaded image */
  archive: ArchiveUploadFunc

  constructor(fetchData: FetchDataFunc, shopId: string) {
    this.archive = archive(fetchData)
    this.getById = getById(fetchData)
    this.getList = getList(fetchData)
    this.uploadImage = uploadImage(fetchData)
  }
}

export default Uploads
