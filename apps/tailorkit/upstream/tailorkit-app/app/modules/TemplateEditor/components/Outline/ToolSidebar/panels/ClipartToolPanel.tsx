import { TextField, Popover, ActionList } from '@shopify/polaris'
import { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchIcon, ChevronDownIcon } from '@shopify/polaris-icons'
import styles from './styles.module.css'
import { useDebounce } from '~/utils/hooks/useDebounce'
import { useClipartCategories } from '~/utils/hooks/useClipartCategories'
import { ToolPanelWrapper } from '../components/ToolPanelWrapper'
import ClipartList from './components/ClipartList'
import { ClickContext } from '~/models/ClipartClickEvent'

interface IClipartToolPanelProps {}

export default function ClipartToolPanel(_props: IClipartToolPanelProps) {
  const { t } = useTranslation()

  // Filters state
  const [queryString, setQueryString] = useState('')
  const {
    categories,
    selectedTab: tabIdx,
    setSelectedTab: setTabIdx,
    selectedCategories,
  } = useClipartCategories({ withAISuggestion: false })
  const [morePopoverActive, setMorePopoverActive] = useState(false)
  const queryStringDebounced = useDebounce(queryString, 400)

  // Visible tabs (All + first few categories)
  const visibleTabs = useMemo(() => {
    const tabs = [{ label: t('all'), value: 'all' }]
    if (categories.length > 0) {
      tabs.push({
        label: categories[0].charAt(0).toUpperCase() + categories[0].slice(1),
        value: categories[0],
      })
    }
    return tabs
  }, [categories, t])

  // More tabs (remaining categories)
  const moreTabs = useMemo(() => {
    return categories.slice(1).map(cat => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: cat,
    }))
  }, [categories])

  // Tab handlers
  const handleTabClick = useCallback(
    (value: string) => {
      const nextIdx = value === 'all' ? 0 : Math.max(0, categories.findIndex(c => c === value) + 1)
      setTabIdx(nextIdx)
      setMorePopoverActive(false)
    },
    [categories, setTabIdx]
  )

  const toggleMorePopover = useCallback(() => {
    setMorePopoverActive(prev => !prev)
  }, [])

  return (
    <ToolPanelWrapper
      header={
        <>
          {/* Search input */}
          <div className={styles.searchField}>
            <TextField
              label=""
              value={queryString}
              onChange={setQueryString}
              placeholder={t('search-cliparts')}
              autoComplete="off"
              prefix={<SearchIcon />}
              clearButton
              onClearButtonClick={() => setQueryString('')}
            />
          </div>

          {/* Tabs */}
          <div className={styles.tabsContainer}>
            {visibleTabs.map(tab => (
              <button
                key={tab.value}
                className={
                  (tab.value === 'all' && tabIdx === 0) || (tab.value !== 'all' && categories[tabIdx - 1] === tab.value)
                    ? styles.tabActive
                    : styles.tab
                }
                onClick={() => handleTabClick(tab.value)}
              >
                {tab.label}
              </button>
            ))}

            {/* More dropdown */}
            {moreTabs.length > 0 && (
              <Popover
                active={morePopoverActive}
                activator={
                  <button className={styles.tab} onClick={toggleMorePopover}>
                    {t('more')}
                    <ChevronDownIcon />
                  </button>
                }
                onClose={() => setMorePopoverActive(false)}
              >
                <ActionList
                  items={moreTabs.map(tab => ({
                    content: tab.label,
                    onAction: () => handleTabClick(tab.value),
                  }))}
                />
              </Popover>
            )}
          </div>
        </>
      }
      contentClassName={styles.contentArea}
    >
      <ClipartList
        trackingContext={ClickContext.EDITOR_CLIPART_PANEL}
        categories={selectedCategories}
        queryString={queryStringDebounced}
        columns={2}
        gapPx={8}
        showTitle={false}
        showTitleOnHover={false}
        showViewDemo={true}
        lazy={true}
      />
    </ToolPanelWrapper>
  )
}
