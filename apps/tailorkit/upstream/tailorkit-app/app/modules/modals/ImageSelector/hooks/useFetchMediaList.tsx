import uniqBy from 'lodash/uniqBy'
import { useCallback, useEffect, useState, useRef } from 'react'
import { type IPageInfo } from '~/types/shopify-product'
import fetchMediaList from '../utilities/fetchMediaList'
import type { IImageQuery } from '~/types/shopify-files'

const defaultPageInfo = { hasNextPage: false, endCursor: '', hasPreviousPage: false, startCursor: '' }

/**
 * Custom hook to fetch and manage media list with pagination
 * @param {Object} params - Hook parameters
 * @param {string} params.textFieldValue - Search query value
 * @returns {Object} Media list state and handlers
 */
export const useFetchMediaList = ({ textFieldValue }: { textFieldValue: string }) => {
  const [isFetching, setIsFetching] = useState(false)
  const [mediaList, setMediaList] = useState<IImageQuery[]>([])
  const [pageInfoMedia, setPageInfoMedia] = useState<IPageInfo>(defaultPageInfo)
  const [fetchNextPage, setFetchNextPage] = useState(false)

  // Use ref to store mediaList to avoid it being a dependency in fetchData
  const mediaListRef = useRef<IImageQuery[]>([])
  mediaListRef.current = mediaList

  const fetchData = useCallback(
    async (pageInfoMedia: IPageInfo = defaultPageInfo, forceFetch = false) => {
      const mediaListFetched = await fetchMediaList({
        pageInfo: pageInfoMedia,
        isFetchNextPage: !forceFetch,
        queryValue: textFieldValue,
      })

      const { mediaList: newMediaList, pageInfo } = mediaListFetched || {
        mediaList: [],
        pageInfo: defaultPageInfo,
      }

      const combinedMediaList = mediaListRef.current.length
        ? uniqBy([...mediaListRef.current, ...newMediaList], 'id')
        : newMediaList

      setMediaList(forceFetch ? newMediaList : combinedMediaList)
      setPageInfoMedia(pageInfo)
    },
    [textFieldValue]
  )

  const handleFetchMoreMedia = useCallback(async () => {
    try {
      const { hasNextPage } = pageInfoMedia

      if (hasNextPage && !fetchNextPage) {
        // Add fetchNextPage check
        setFetchNextPage(true)
        await fetchData(pageInfoMedia)
      }
    } catch (error) {
      console.error('Error fetching more media:', error)
    } finally {
      setFetchNextPage(false)
    }
  }, [fetchData, pageInfoMedia, fetchNextPage])

  useEffect(() => {
    let isActive = true

    const initFetch = async () => {
      setIsFetching(true)
      try {
        await fetchData(defaultPageInfo, true)
      } catch (error) {
        console.error('Failed to fetch media: ', error)
      } finally {
        if (isActive) {
          setIsFetching(false)
        }
      }
    }

    initFetch()

    return () => {
      isActive = false
    }
  }, [fetchData])

  return {
    isFetching,
    mediaList,
    fetchNextPage,
    handleFetchMoreMedia,
  }
}
