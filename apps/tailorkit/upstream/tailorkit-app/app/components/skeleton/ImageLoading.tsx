import styles from './image-loading.module.css'

const ImageLoadingSkeleton = ({
  width,
  height,
  style = {},
}: {
  width: string
  height: string
  style?: React.CSSProperties
}) => {
  return <div className={styles.Skeleton} style={{ width, height, ...style }}></div>
}

export default ImageLoadingSkeleton
